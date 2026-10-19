import AppRoutes from "./routes/AppRoutes";
import { useEffect } from "react";
import { iniciarRenovacaoSessao } from "./services/renovacaoSessao";

function App() {
    useEffect(iniciarRenovacaoSessao, []);
    return <AppRoutes />;
}

export default App;
