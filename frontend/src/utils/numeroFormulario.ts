/** Texto de edição → decimal com ponto. Nunca arredonda ou descarta caracteres inválidos. */
export function normalizarDecimal(valor: string, casas: number, moeda = false): string | null {
    let texto = valor.trim();
    if (moeda) texto = texto.replace(/^R\$\s*/, "");
    if (!texto) return "";
    if (texto.includes(",")) {
        if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d*$/.test(texto)) return null;
        texto = texto.replaceAll(".", "").replace(",", ".");
    }
    const partes = /^(\d+)(?:\.(\d*))?$/.exec(texto);
    if (!partes || (partes[2]?.length ?? 0) > casas) return null;
    return `${partes[1].replace(/^0+(?=\d)/, "")}${partes[2] ? `.${partes[2]}` : ""}`;
}

function escalado(valor: string, casas: number): bigint {
    const [inteiro, fracao = ""] = valor.split(".");
    return BigInt(inteiro) * 10n ** BigInt(casas) + BigInt(fracao.padEnd(casas, "0") || "0");
}

/** O contrato HTTP existente usa number; valores sem representação decimal segura são rejeitados. */
export function numeroDecimal(valor: string, casas: number, moeda = false): number | null {
    const normalizado = normalizarDecimal(valor, casas, moeda);
    if (!normalizado || escalado(normalizado, casas) > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const numero = Number(normalizado);
    const retorno = normalizarDecimal(String(numero), casas);
    return retorno && escalado(retorno, casas) === escalado(normalizado, casas) ? numero : null;
}

export function formatarDecimal(valor: string, casas: number, moeda = false, casasMinimas = casas): string {
    const numero = numeroDecimal(valor, casas, moeda);
    return numero === null ? valor : new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: casasMinimas, maximumFractionDigits: casas, useGrouping: casasMinimas > 0,
    }).format(numero);
}

/** Passos em inteiros escalados evitam 0,1 + 0,2 e arredondamentos intermediários. */
export function ajustarDecimal(valor: string, casas: number, passo: string, direcao: 1 | -1,
    minimo = 0, maximo?: number): string | null {
    const atual = normalizarDecimal(valor, casas);
    const incremento = normalizarDecimal(passo, casas);
    if (atual === null || !incremento || numeroDecimal(passo, casas) === null || Number(incremento) <= 0) return null;
    if (atual && numeroDecimal(atual, casas) === null) return null;
    let proximo = escalado(atual || String(minimo), casas) + BigInt(direcao) * escalado(incremento, casas);
    const piso = escalado(String(minimo), casas);
    if (proximo < piso) proximo = piso;
    if (maximo !== undefined) {
        const teto = escalado(String(maximo), casas);
        if (proximo > teto) proximo = teto;
    }
    if (proximo > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const digitos = proximo.toString().padStart(casas + 1, "0");
    return casas ? `${digitos.slice(0, -casas)},${digitos.slice(-casas)}` : digitos;
}
