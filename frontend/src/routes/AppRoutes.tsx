import { type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import Login from "../pages/Login/Login";
import { possuiSessao } from "../utils/auth/sessao";
import { rotasInternas } from "./navigation";

type RotaPublicaProps = {
    children: ReactNode;
};

function RotaProtegida() {
    return possuiSessao() ? <Outlet /> : <Navigate to="/login" replace />;
}

function RotaPublica({ children }: RotaPublicaProps) {
    return possuiSessao() ? <Navigate to="/dashboard" replace /> : children;
}

function RedirecionamentoInicial() {
    return (
        <Navigate
            to={possuiSessao() ? "/dashboard" : "/login"}
            replace
        />
    );
}

function AppRoutes() {
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

            <Route element={<RotaProtegida />}>
                <Route element={<MainLayout />}>
                    {rotasInternas.map((rota) => (
                        <Route
                            key={rota.caminho}
                            path={rota.caminho}
                            element={rota.elemento}
                        />
                    ))}
                </Route>
            </Route>

            <Route
                path="/inicio"
                element={<Navigate to="/dashboard" replace />}
            />
            <Route path="/" element={<RedirecionamentoInicial />} />
            <Route path="*" element={<RedirecionamentoInicial />} />
        </Routes>
    );
}

export default AppRoutes;
