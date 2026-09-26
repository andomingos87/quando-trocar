// Pools de nomes, cidades, veículos e geradores de identificadores FICTÍCIOS.
// Telefones sempre no DDD 00/01/02 (inexistentes no Brasil): passam no check E.164 do banco,
// nunca alcançam ninguém e são a chave de purge.
import type { Rng } from "./prng";

export const PREFIXO_OFICINA = "+5500";
export const PREFIXO_CLIENTE = "+5501";
export const PREFIXO_PROSPECCAO = "+5502";

const NOMES_M = [
  "Carlos", "José", "Paulo", "Marcos", "Antônio", "Rafael", "Rodrigo", "Fernando", "Ricardo", "Eduardo",
  "André", "Bruno", "Diego", "Felipe", "Gustavo", "Leandro", "Luciano", "Márcio", "Roberto", "Sérgio",
  "Tiago", "Wagner", "Wellington", "Anderson", "Cláudio", "Everton", "Fábio", "Gilberto", "Jefferson", "Júlio",
  "Adriano", "Alex", "Douglas", "Edson", "Élton", "Geraldo", "Ivan", "Jair", "Juliano", "Kleber",
  "Luiz", "Mauro", "Nelson", "Osvaldo", "Renato", "Reginaldo", "Robson", "Ronaldo", "Sandro", "Valdir",
];
const NOMES_F = [
  "Ana", "Maria", "Juliana", "Fernanda", "Patrícia", "Aline", "Camila", "Daniela", "Renata", "Simone",
  "Cristiane", "Eliane", "Fabiana", "Gisele", "Jéssica", "Letícia", "Luciana", "Mariana", "Priscila", "Vanessa",
  "Adriana", "Bruna", "Carla", "Débora", "Elaine", "Flávia", "Kelly", "Michele", "Rosana", "Tatiane",
];
const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Lima", "Costa", "Ferreira", "Rodrigues", "Almeida",
  "Nascimento", "Araújo", "Carvalho", "Gomes", "Martins", "Ribeiro", "Rocha", "Barbosa", "Dias", "Moreira",
  "Nunes", "Mendes", "Cardoso", "Teixeira", "Correia", "Cavalcante", "Freitas", "Vieira", "Monteiro", "Castro",
  "Batista", "Campos", "Fonseca", "Machado", "Moura", "Pinto", "Ramos", "Reis", "Sales", "Tavares",
];

export function nomePessoa(rng: Rng, genero?: "m" | "f"): string {
  const g = genero ?? (rng.chance(0.78) ? "m" : "f");
  const nome = rng.pick(g === "m" ? NOMES_M : NOMES_F);
  return `${nome} ${rng.pick(SOBRENOMES)}`;
}

export function primeiroNome(nome: string): string {
  return nome.split(" ")[0];
}

// Cidades com peso: interior de SP forte (onde o produto nasce), capitais e PR/MG/RJ/RS/SC.
export const CIDADES: ReadonlyArray<readonly [string, string, number]> = [
  ["São Paulo", "SP", 14], ["Guarulhos", "SP", 8], ["Campinas", "SP", 7], ["Sorocaba", "SP", 5],
  ["Ribeirão Preto", "SP", 5], ["São José dos Campos", "SP", 4], ["Santo André", "SP", 4], ["Osasco", "SP", 4],
  ["Piracicaba", "SP", 3], ["Bauru", "SP", 3], ["Jundiaí", "SP", 3], ["Limeira", "SP", 2], ["Franca", "SP", 2],
  ["Curitiba", "PR", 6], ["Londrina", "PR", 3], ["Maringá", "PR", 3], ["Cascavel", "PR", 2],
  ["Belo Horizonte", "MG", 5], ["Uberlândia", "MG", 3], ["Juiz de Fora", "MG", 2], ["Contagem", "MG", 2],
  ["Rio de Janeiro", "RJ", 5], ["Niterói", "RJ", 2], ["Duque de Caxias", "RJ", 2],
  ["Porto Alegre", "RS", 3], ["Caxias do Sul", "RS", 2], ["Joinville", "SC", 2], ["Florianópolis", "SC", 2],
  ["Goiânia", "GO", 3], ["Brasília", "DF", 2], ["Salvador", "BA", 2], ["Recife", "PE", 2], ["Fortaleza", "CE", 2],
];

export function cidade(rng: Rng): { cidade: string; uf: string } {
  const [c, uf] = rng.weighted(CIDADES.map(([c, uf, w]) => [[c, uf] as const, w] as const));
  return { cidade: c, uf };
}

const PREFIXOS_OFICINA = [
  "Auto Center", "Oficina", "Mecânica", "Centro Automotivo", "Auto Mecânica", "Lubrificantes", "Troca de Óleo",
  "Auto Peças e Serviços", "Garagem", "Serviços Automotivos", "Auto Service", "Pit Stop", "Autocenter",
];
const SUFIXOS_OFICINA = [
  "do Zé", "Irmãos", "Express", "Total", "Premium", "Master", "Plus", "Sul", "Norte", "Central", "Real",
  "Nova", "Boa Vista", "do Bairro", "Rápida", "Car", "Motors", "Truck", "& Cia", "Diesel",
];
const BAIRROS = [
  "Centro", "Vila Nova", "Jardim América", "Jardim das Flores", "Vila Industrial", "Parque das Nações",
  "Bela Vista", "Vila Progresso", "Jardim Europa", "Cidade Nova", "São José", "Santa Cruz", "Boa Vista",
  "Jardim Paulista", "Vila Maria", "Alto da Serra", "Jardim Primavera", "Vila Formosa", "Piratininga",
];
const LOGRADOUROS = [
  "Av. Brasil", "Rua das Palmeiras", "Av. Marginal", "Rua São João", "Av. Industrial", "Rua XV de Novembro",
  "Av. dos Autonomistas", "Rua Tiradentes", "Av. Presidente Vargas", "Rua Sete de Setembro", "Rodovia SP-330, km",
  "Av. Anhanguera", "Rua Bahia", "Av. Paulista", "Rua Amazonas", "Av. das Nações", "Rua Rio Branco",
];

export function nomeOficina(rng: Rng, responsavel: string): string {
  const sobrenome = responsavel.split(" ").slice(-1)[0];
  const primeiro = primeiroNome(responsavel);
  return rng.weighted([
    [`${rng.pick(PREFIXOS_OFICINA)} ${sobrenome}`, 30],
    [`${rng.pick(PREFIXOS_OFICINA)} ${primeiro}`, 18],
    [`${rng.pick(PREFIXOS_OFICINA)} ${rng.pick(SUFIXOS_OFICINA)}`, 22],
    [`${rng.pick(PREFIXOS_OFICINA)} ${rng.pick(BAIRROS)}`, 12],
    [`${sobrenome} ${rng.pick(["Pneus", "Auto Peças", "Motors", "Car Service", "Lubrificação"])}`, 10],
    [`${primeiro.slice(0, 2).toUpperCase()}${sobrenome.slice(0, 1).toUpperCase()} ${rng.pick(["Auto Center", "Mecânica", "Centro Automotivo"])}`, 8],
  ]);
}

export function endereco(rng: Rng): { bairro: string; logradouro: string; numero: string; cep: string } {
  return {
    bairro: rng.pick(BAIRROS),
    logradouro: rng.pick(LOGRADOUROS),
    numero: String(rng.int(12, 4800)),
    cep: `${rng.int(10, 99)}${rng.digits(6)}`,
  };
}

const VEICULOS = [
  ["Onix", 2017, 2024], ["HB20", 2016, 2024], ["Gol", 2010, 2022], ["Corolla", 2014, 2024], ["Civic", 2012, 2022],
  ["Strada", 2014, 2024], ["Argo", 2018, 2024], ["Polo", 2018, 2024], ["Kwid", 2018, 2024], ["Mobi", 2017, 2024],
  ["Compass", 2017, 2024], ["Renegade", 2016, 2024], ["T-Cross", 2019, 2024], ["Creta", 2017, 2024], ["Toro", 2017, 2024],
  ["Hilux", 2013, 2024], ["S10", 2013, 2024], ["Saveiro", 2012, 2024], ["Fiesta", 2011, 2019], ["Ka", 2014, 2021],
  ["Uno", 2010, 2021], ["Palio", 2010, 2017], ["Celta", 2010, 2015], ["Sandero", 2014, 2023], ["Logan", 2014, 2023],
  ["Duster", 2015, 2024], ["Tracker", 2020, 2024], ["Nivus", 2020, 2024], ["Virtus", 2018, 2024], ["Cronos", 2018, 2024],
  ["Fit", 2012, 2020], ["HR-V", 2016, 2024], ["City", 2013, 2024], ["Etios", 2013, 2021], ["Yaris", 2018, 2024],
  ["Cobalt", 2012, 2020], ["Prisma", 2013, 2020], ["Spin", 2013, 2024], ["Montana", 2012, 2024], ["Fox", 2010, 2021],
  ["Voyage", 2012, 2023], ["Jetta", 2014, 2022], ["Pulse", 2022, 2024], ["Fastback", 2023, 2024], ["Kicks", 2017, 2024],
  ["Versa", 2016, 2024], ["March", 2012, 2020], ["Ecosport", 2013, 2021], ["Ranger", 2014, 2024], ["Amarok", 2014, 2024],
  ["Fiorino", 2014, 2024], ["Ducato", 2015, 2023], ["Sprinter", 2014, 2023], ["Master", 2015, 2023], ["Corsa", 2008, 2012],
] as const;

export function veiculo(rng: Rng): string {
  const [modelo, de, ate] = rng.pick(VEICULOS);
  return `${modelo} ${rng.int(de, ate)}`;
}

export function placa(rng: Rng): string | null {
  if (!rng.chance(0.55)) return null;
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = () => L[rng.int(0, 25)];
  return rng.chance(0.6)
    ? `${l()}${l()}${l()}${rng.int(0, 9)}${l()}${rng.int(0, 9)}${rng.int(0, 9)}`
    : `${l()}${l()}${l()}-${rng.digits(4)}`;
}

/** Telefone da oficina/lead: +5500 9 + 8 dígitos sequenciais (único por construção). */
export function foneOficina(seq: number): string {
  return `${PREFIXO_OFICINA}9${String(seq).padStart(8, "0")}`;
}
export function foneCliente(seq: number): string {
  return `${PREFIXO_CLIENTE}9${String(seq).padStart(8, "0")}`;
}
export function foneProspeccao(seq: number): string {
  return `${PREFIXO_PROSPECCAO}9${String(seq).padStart(8, "0")}`;
}

/** Como a oficina digita o telefone do cliente na mensagem. */
export function foneEscrito(rng: Rng, e164: string): string {
  const ddd = e164.slice(3, 5);
  const n = e164.slice(5);
  return rng.weighted([
    [`${ddd} ${n.slice(0, 5)}-${n.slice(5)}`, 40],
    [`(${ddd}) ${n.slice(0, 5)}-${n.slice(5)}`, 25],
    [`${ddd}${n}`, 25],
    [`${ddd} ${n.slice(0, 1)} ${n.slice(1, 5)} ${n.slice(5)}`, 10],
  ]);
}

function dv(nums: number[], pesos: number[]): number {
  const soma = nums.reduce((acc, n, i) => acc + n * pesos[i], 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

/** CNPJ fictício com dígitos verificadores válidos (raiz aleatória, filial 0001). */
export function cnpj(rng: Rng): string {
  const base = [...rng.digits(8), "0", "0", "0", "1"].map(Number);
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base.join("")}${d1}${d2}`;
}

/** CPF fictício com dígitos verificadores válidos. */
export function cpf(rng: Rng): string {
  const base = [...rng.digits(9)].map(Number);
  const d1 = dv(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base.join("")}${d1}${d2}`;
}

export function emailOficina(rng: Rng, nome: string): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return `${slug}${rng.int(1, 99)}@${rng.pick(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"])}`;
}

export function ipFicticio(rng: Rng): string {
  return `${rng.pick([177, 179, 187, 189, 191, 200, 201])}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
}
