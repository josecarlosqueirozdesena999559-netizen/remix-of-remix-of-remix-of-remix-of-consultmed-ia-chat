import { MessageCircle, X, Send, Package, Calendar, Hash } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePostos } from '@/hooks/usePostos';
import { useMedicamentos, type MedicamentoAI, type LoteInfo } from '@/hooks/useMedicamentos';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  medicamentosAI?: MedicamentoAI[];
  postosList?: PostoOption[];
}

interface PostoOption {
  id: string;
  nome: string;
  localidade: string;
}

type ChatStep = 'welcome' | 'ask_name' | 'ask_posto' | 'select_posto' | 'ask_medicamento' | 'show_result' | 'ask_continue';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<ChatStep>('welcome');
  const [userName, setUserName] = useState('');
  const [selectedPosto, setSelectedPosto] = useState<{ id: string; nome: string; localidade: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { postos, loading: loadingPostos, searchPostos } = usePostos();
  const { resolveMedicamentoQuery, searchMedicamentoWithAI, getPdfUrl, loading: searchingMed } = useMedicamentos();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (text: string, isBot: boolean, medicamentosAI?: MedicamentoAI[], postosList?: PostoOption[]) => {
    const id = Date.now().toString();
    setMessages(prev => [...prev, { id, text, isBot, medicamentosAI, postosList }]);
  };

  const openChat = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setTimeout(() => {
        addMessage('Olá! 👋 Eu sou o Chatbot do ConsultMed IA! Estou aqui para ajudar você a consultar medicamentos disponíveis nas UBS da sua cidade.', true);
        setTimeout(() => {
          addMessage('Para começar, qual é o seu nome?', true);
          setStep('ask_name');
        }, 1000);
      }, 500);
    }
  };

  const handlePostoSelect = async (posto: PostoOption) => {
    setSelectedPosto(posto);
    addMessage(posto.nome, false);

    const url = await getPdfUrl(posto.id);
    setPdfUrl(url);

    setTimeout(() => {
      addMessage(`Ótimo! ✅ Você selecionou ${posto.nome} - ${posto.localidade}. Qual medicamento você gostaria de consultar?`, true);
      setStep('ask_medicamento');
    }, 500);
  };

  const handleSend = async () => {
    if (!input.trim() || searchingMed) return;

    const userInput = input.trim();
    addMessage(userInput, false);
    setInput('');

    switch (step) {
      case 'ask_name':
        setUserName(userInput);
        setTimeout(() => {
          if (loadingPostos) {
            addMessage('Carregando postos disponíveis...', true);
          } else if (postos.length === 0) {
            addMessage(`Prazer em conhecer você, ${userInput}! Infelizmente não há postos disponíveis no momento.`, true);
          } else {
            const postoOptions = postos.map(p => ({ id: p.id, nome: p.nome, localidade: p.localidade }));
            addMessage(`Prazer em conhecer você, ${userInput}! 😊 Selecione o posto de saúde que deseja consultar:`, true, undefined, postoOptions);
            setStep('select_posto');
          }
        }, 500);
        break;

      case 'select_posto':
        const foundPostos = searchPostos(userInput);
        if (foundPostos.length === 0) {
          addMessage(`Não encontrei nenhum posto com "${userInput}". Por favor, selecione um posto da lista acima ou digite outro nome.`, true);
        } else if (foundPostos.length === 1) {
          handlePostoSelect(foundPostos[0]);
        } else {
          const postoOptions = foundPostos.map(p => ({ id: p.id, nome: p.nome, localidade: p.localidade }));
          addMessage(`Encontrei ${foundPostos.length} postos. Selecione um:`, true, undefined, postoOptions);
        }
        break;

      case 'ask_medicamento':
        if (!selectedPosto) return;

        // Validação: não permitir busca com apenas números
        const hasOnlyNumbers = /^\d+$/.test(userInput);
        if (hasOnlyNumbers) {
          addMessage('⚠️ Por favor, digite o **nome** do medicamento (ex: Paracetamol, Dipirona). Números não são aceitos para busca.', true);
          return;
        }

        // Resolve o melhor termo para o PDF (prefixo, marca->substância, e correção de erro de digitação)
        let queryForPdf = userInput;
        try {
          queryForPdf = await resolveMedicamentoQuery(selectedPosto.id, userInput);
        } catch {
          // se falhar, segue com o texto digitado
        }

        const pdfResponse = await searchMedicamentoWithAI(
          selectedPosto.nome,
          selectedPosto.localidade,
          queryForPdf,
          pdfUrl
        );

        if (pdfResponse.encontrado && pdfResponse.medicamentos.length > 0) {
          // Verifica se o usuário buscou por marca/termo diferente do nome do medicamento
          const userTermNorm = userInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const firstMedNorm = pdfResponse.medicamentos[0]?.nome?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
          const searchedByBrand = userTermNorm && !firstMedNorm.startsWith(userTermNorm.split(' ')[0]);

          let msg = pdfResponse.mensagem;
          if (searchedByBrand) {
            const qtd = pdfResponse.medicamentos.length;
            msg = `Encontrei ${qtd} medicamento${qtd > 1 ? 's' : ''} para "${userInput}" (nome comercial/marca). Veja abaixo o princípio ativo:`;
          }
          addMessage(`✅ ${msg}`, true, pdfResponse.medicamentos);
        } else {
          // Mensagem diferente se o medicamento pode ter acabado
          if (pdfResponse.podeEstarEsgotado) {
            addMessage(`⚠️ O medicamento "${userInput}" não está disponível no estoque atual deste posto. É possível que ele tenha acabado ou não seja distribuído nesta unidade no momento. Recomendo verificar diretamente no posto.`, true);
          } else {
            addMessage(pdfResponse.mensagem || `Não encontrei "${userInput}" no PDF deste posto.`, true);
          }
        }

        setTimeout(() => {
          addMessage(`📍 Para mais informações, compareça ao ${selectedPosto.nome} (${selectedPosto.localidade}) com receita médica e Cartão do SUS.`, true);
          setTimeout(() => {
            addMessage('Deseja fazer uma nova consulta?\n\n1️⃣ Outro medicamento neste posto\n2️⃣ Consultar outro posto\n3️⃣ Encerrar', true);
            setStep('ask_continue');
          }, 1000);
        }, 1000);
        break;

      case 'ask_continue':
        const option = userInput.toLowerCase();
        if (option === '1' || option.includes('outro medicamento') || option.includes('mesmo posto')) {
          addMessage(`Ok! Qual medicamento você gostaria de consultar no ${selectedPosto?.nome}?`, true);
          setStep('ask_medicamento');
        } else if (option === '2' || option.includes('outro posto') || option.includes('trocar')) {
          setSelectedPosto(null);
          setPdfUrl(null);
          const postoOptions = postos.map(p => ({ id: p.id, nome: p.nome, localidade: p.localidade }));
          addMessage('Sem problemas! 😊 Selecione o posto de saúde que deseja consultar:', true, undefined, postoOptions);
          setStep('select_posto');
        } else if (option === '3' || option.includes('encerrar') || option.includes('sair') || option.includes('não') || option.includes('nao')) {
          addMessage(`Foi um prazer ajudar você, ${userName}! 👋 Até a próxima. Cuide-se!`, true);
          setStep('welcome');
        } else {
          addMessage('Por favor, digite 1, 2 ou 3 para escolher uma opção.', true);
        }
        break;

      default:
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderLoteInfo = (lote: LoteInfo, index: number) => (
    <div key={index} className="bg-muted/50 rounded-md p-2 text-xs space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Hash className="w-3 h-3" />
        <span>Lote: <span className="font-medium text-foreground">{lote.lote}</span></span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>Validade: <span className="font-medium text-foreground">{lote.validade}</span></span>
      </div>
      <div className="flex items-center gap-1.5 text-primary font-semibold">
        <Package className="w-3 h-3" />
        <span>Quantidade: {lote.quantidade}</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating bubble with label */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2">
        {!isOpen && (
          <div 
            onClick={openChat}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-full text-xs sm:text-sm font-medium shadow-lg cursor-pointer hover:bg-accent transition-colors animate-bounce max-w-[200px] sm:max-w-none text-center"
          >
            💊 Consulte medicamentos
          </div>
        )}
        
        <button
          onClick={() => isOpen ? setIsOpen(false) : openChat()}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-accent transition-all duration-300 flex items-center justify-center"
          aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
        >
          {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
      </div>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-2 sm:right-6 left-2 sm:left-auto z-50 sm:w-[380px] h-[70vh] sm:h-[520px] max-h-[520px] bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Chatbot ConsultMed IA</h3>
              <p className="text-xs opacity-80">Consulta de medicamentos</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-line ${
                    msg.isBot
                      ? 'bg-secondary text-secondary-foreground rounded-tl-sm'
                      : 'bg-primary text-primary-foreground rounded-tr-sm'
                  }`}
                >
                  {msg.text}
                  
                  {/* Postos list buttons */}
                  {msg.postosList && msg.postosList.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.postosList.map((posto) => (
                        <button
                          key={posto.id}
                          onClick={() => handlePostoSelect(posto)}
                          className="w-full text-left p-2 bg-background rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-xs"
                        >
                          <div className="font-medium">{posto.nome}</div>
                          <div className="text-muted-foreground text-xs">{posto.localidade}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Medicamentos com lotes detalhados */}
                  {msg.medicamentosAI && msg.medicamentosAI.length > 0 && (
                    <div className="mt-3 bg-background rounded-lg overflow-hidden border-2 border-primary/30 shadow-sm">
                      <div className="bg-primary/10 px-3 py-2 border-b border-primary/20">
                        <span className="text-xs font-semibold text-primary">📋 Medicamentos Encontrados</span>
                      </div>
                      <div className="divide-y divide-border">
                        {msg.medicamentosAI.map((med, i) => (
                          <div key={i} className="p-3">
                            {/* Nome e código do medicamento */}
                            <div className="font-bold text-primary text-sm mb-1">
                              💊 {med.nome}
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Código: <span className="font-medium text-foreground">{med.codigo}</span>
                            </div>
                            {med.unidade && (
                              <div className="text-xs text-muted-foreground mb-2">
                                Unidade: <span className="font-medium text-foreground">{med.unidade}</span>
                              </div>
                            )}
                            
                            {/* Lista de lotes */}
                            {med.lotes && med.lotes.length > 0 && (
                              <div className="space-y-2 mb-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                  📦 Lotes disponíveis ({med.lotes.length}):
                                </div>
                                <div className="space-y-1.5">
                                  {med.lotes.map((lote, idx) => renderLoteInfo(lote, idx))}
                                </div>
                              </div>
                            )}
                            
                            {/* Total */}
                            <div className="pt-2 border-t border-border">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Total (conforme PDF):</span>
                                <span className="font-bold text-primary text-sm">{med.quantidadeTotal}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {searchingMed && (
              <div className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-2xl rounded-tl-sm text-sm">
                  <span className="animate-pulse">💊 Consultando seu medicamento...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-background">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-4 py-2 rounded-full border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={searchingMed}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || searchingMed}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}