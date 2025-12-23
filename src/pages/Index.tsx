import { ChatWidget } from '@/components/ChatWidget';

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">ConsultMed IA</h1>
        <p className="text-xl text-muted-foreground">Consulte medicamentos disponiveis nas UBS da sua cidade</p>
      </div>
      
      <ChatWidget />
    </div>
  );
};

export default Index;
