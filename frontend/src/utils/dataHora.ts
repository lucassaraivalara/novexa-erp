/** Contrato: LocalDateTime sem offset é horário civil de Brasília; Z/offset é instante. */
export const FUSO_NOVEXA = "America/Sao_Paulo";

const partesBrasilia = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_NOVEXA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function partes(data: Date) {
    return Object.fromEntries(partesBrasilia.formatToParts(data).map(p => [p.type, p.value]));
}
const instanteDasPartes = (p: Record<string, string>) =>
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));

export function interpretarDataHora(valor: string | Date): Date | null {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)) {
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? null : data;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(valor);
    if (!m) return null;
    const civil = { year: m[1], month: m[2], day: m[3], hour: m[4], minute: m[5], second: m[6] ?? "00" };
    const alvo = instanteDasPartes(civil);
    let instante = alvo;
    // Resolve o offset pelas regras IANA, inclusive datas históricas com horário de verão.
    // Nunca interpretar LocalDateTime no fuso do navegador nem subtrair horas fixas.
    for (let i = 0; i < 3; i++) {
        const observado = instanteDasPartes(partes(new Date(instante)));
        if (observado === alvo) {
            const data = new Date(instante + Number((m[7] ?? "").padEnd(3, "0").slice(0, 3)));
            const p = partes(data);
            return Object.keys(civil).every(k => p[k] === civil[k as keyof typeof civil]) ? data : null;
        }
        instante += alvo - observado;
    }
    return null;
}

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_NOVEXA, dateStyle: "short", timeStyle: "short" });
const dataCivil = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_NOVEXA, dateStyle: "short" });
export function formatarDataHora(valor: string | Date | null | undefined) {
    const data = valor ? interpretarDataHora(valor) : null;
    return data ? dataHora.format(data) : "—";
}
export function formatarData(valor: string | null | undefined) {
    const data = valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? interpretarDataHora(`${valor}T12:00:00`) : null;
    return data ? dataCivil.format(data) : "—";
}
export function hojeBrasilia(agora = new Date()) {
    const p = partes(agora);
    return `${p.year}-${p.month}-${p.day}`;
}
export function horaBrasilia(agora = new Date()) { return Number(partes(agora).hour); }
export function dataExtensaBrasilia(agora = new Date()) {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: FUSO_NOVEXA, day: "2-digit", month: "long", year: "numeric",
    }).format(agora);
}
export function somarDias(data: string, dias: number) {
    // Aritmética de calendário, sem converter um dia civil em instante do navegador.
    const valor = new Date(`${data}T12:00:00Z`);
    valor.setUTCDate(valor.getUTCDate() + dias);
    return valor.toISOString().slice(0, 10);
}
