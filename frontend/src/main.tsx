// Importa o StrictMode do React.
// Ele ajuda a identificar possíveis problemas durante o desenvolvimento.
import { StrictMode } from "react";

// Importa a função responsável por criar a aplicação React
// e colocá-la dentro do elemento "root" do HTML.
import { createRoot } from "react-dom/client";

// Importa o ThemeProvider do MUI.
// Ele disponibiliza o nosso tema para todos os componentes
// que estiverem dentro dele.
import { ThemeProvider } from "@mui/material/styles";

// Importa o CSS global da aplicação.
import "./index.css";

// Importa o componente principal da aplicação.
import App from "./App.tsx";

// Importa o tema que criamos no arquivo theme.ts.
import theme from "./theme/theme.ts";


// Procura no arquivo index.html o elemento que possui o id "root"
// e cria a aplicação React dentro dele.
createRoot(document.getElementById("root")!).render(

    // StrictMode envolve nossa aplicação durante o desenvolvimento.
    <StrictMode>

        {/* 
            ThemeProvider disponibiliza o nosso tema MUI
            para todos os componentes que estiverem dentro dele.

            O "theme={theme}" está passando para o MUI
            o tema que criamos em src/theme/theme.ts.
        */}
        <ThemeProvider theme={theme}>

            {/* 
                App é o componente principal da nossa aplicação.

                Tudo que estiver dentro do App poderá utilizar
                o tema do MUI.
            */}
            <App />

        </ThemeProvider>

    </StrictMode>,
);