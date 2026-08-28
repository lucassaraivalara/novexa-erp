import { type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login/Login.tsx";
import PaginaInicial from "./pages/PaginaInicial/PaginaInicial.tsx";
import { possuiSessao } from "./utils/auth/sessao";

type RotaProps = {
    children: ReactNode;
};

// Esta verificação acontece sempre que a rota é renderizada.
// Assim, login e logout refletem a sessão atual sem recarregar a página.
function RotaProtegida({ children }: RotaProps) {
    return possuiSessao() ? children : <Navigate to="/login" replace />;
}

function RotaPublica({ children }: RotaProps) {
    return possuiSessao() ? <Navigate to="/inicio" replace /> : children;
}

function App() {
    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <RotaPublica>
                        <Login />
                    </RotaPublica>
                }
            />

            <Route
                path="/inicio"
                element={
                    <RotaProtegida>
                        <PaginaInicial />
                    </RotaProtegida>
                }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default App;
