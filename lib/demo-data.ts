export type ReminderStatus = "pendente" | "enviado" | "agendado";
export type ReturnStatus = "concluido";

export type DemoCustomer = {
  id: string;
  name: string;
  whatsapp: string;
  vehicle: string;
  service: string;
  exchangeDate: string;
  reminderDate: string;
  daysSinceExchange: number;
  reminderStatus: ReminderStatus;
  returned: boolean;
  returnStatus?: ReturnStatus;
  returnDate?: string;
  returnValue?: number;
};

export type DemoMetrics = {
  registeredCustomers: number;
  sentReminders: number;
  returnedCustomers: number;
  generatedRevenue: number;
};

export type DemoState = {
  customers: DemoCustomer[];
  baseMetrics: DemoMetrics;
  selectedCustomerId: string;
};

export type NewDemoCustomer = {
  name: string;
  whatsapp: string;
  vehicle: string;
  service: string;
  exchangeDate: string;
};

export const demoWorkshop = {
  name: "Auto Center Silva",
  city: "Curitiba - PR",
  averageTicket: 250,
};

export const initialMetrics: DemoMetrics = {
  registeredCustomers: 128,
  sentReminders: 42,
  returnedCustomers: 11,
  generatedRevenue: 8250,
};

export const demoCustomers: DemoCustomer[] = [
  {
    id: "joao-silva",
    name: "Joao Silva",
    whatsapp: "(41) 99942-1180",
    vehicle: "Civic 2018",
    service: "Troca de oleo",
    exchangeDate: "2026-01-16",
    reminderDate: "2026-04-16",
    daysSinceExchange: 99,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "maria-costa",
    name: "Maria Costa",
    whatsapp: "(41) 98831-2074",
    vehicle: "HB20 2020",
    service: "Troca de oleo",
    exchangeDate: "2026-01-22",
    reminderDate: "2026-04-22",
    daysSinceExchange: 93,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "pedro-lima",
    name: "Pedro Lima",
    whatsapp: "(41) 99760-4419",
    vehicle: "Onix 2022",
    service: "Troca de oleo",
    exchangeDate: "2026-01-28",
    reminderDate: "2026-04-28",
    daysSinceExchange: 87,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "ana-rocha",
    name: "Ana Rocha",
    whatsapp: "(41) 98452-7730",
    vehicle: "Compass 2021",
    service: "Troca de oleo",
    exchangeDate: "2026-01-12",
    reminderDate: "2026-04-12",
    daysSinceExchange: 103,
    reminderStatus: "enviado",
    returned: false,
  },
  {
    id: "carlos-mendes",
    name: "Carlos Mendes",
    whatsapp: "(41) 99671-3342",
    vehicle: "Corolla 2019",
    service: "Troca de oleo",
    exchangeDate: "2026-01-10",
    reminderDate: "2026-04-10",
    daysSinceExchange: 105,
    reminderStatus: "agendado",
    returned: false,
  },
  {
    id: "beatriz-nunes",
    name: "Beatriz Nunes",
    whatsapp: "(41) 99120-6854",
    vehicle: "T-Cross 2023",
    service: "Troca de oleo",
    exchangeDate: "2026-01-25",
    reminderDate: "2026-04-25",
    daysSinceExchange: 90,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "marcos-alves",
    name: "Marcos Alves",
    whatsapp: "(41) 98745-1902",
    vehicle: "Gol 2016",
    service: "Troca de oleo",
    exchangeDate: "2026-01-08",
    reminderDate: "2026-04-08",
    daysSinceExchange: 107,
    reminderStatus: "enviado",
    returned: true,
    returnStatus: "concluido",
    returnDate: "2026-04-18",
    returnValue: 250,
  },
  {
    id: "fernanda-prado",
    name: "Fernanda Prado",
    whatsapp: "(41) 99884-5166",
    vehicle: "Kicks 2021",
    service: "Troca de oleo",
    exchangeDate: "2026-01-05",
    reminderDate: "2026-04-05",
    daysSinceExchange: 110,
    reminderStatus: "enviado",
    returned: true,
    returnStatus: "concluido",
    returnDate: "2026-04-16",
    returnValue: 300,
  },
  {
    id: "ricardo-batista",
    name: "Ricardo Batista",
    whatsapp: "(41) 98215-4078",
    vehicle: "Toro 2020",
    service: "Troca de oleo",
    exchangeDate: "2026-01-18",
    reminderDate: "2026-04-18",
    daysSinceExchange: 97,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "luciana-ferreira",
    name: "Luciana Ferreira",
    whatsapp: "(41) 99710-2298",
    vehicle: "Renegade 2019",
    service: "Troca de oleo",
    exchangeDate: "2026-01-02",
    reminderDate: "2026-04-02",
    daysSinceExchange: 113,
    reminderStatus: "enviado",
    returned: true,
    returnStatus: "concluido",
    returnDate: "2026-04-12",
    returnValue: 260,
  },
  {
    id: "tiago-santos",
    name: "Tiago Santos",
    whatsapp: "(41) 98531-0081",
    vehicle: "S10 2018",
    service: "Troca de oleo",
    exchangeDate: "2026-01-30",
    reminderDate: "2026-04-30",
    daysSinceExchange: 85,
    reminderStatus: "pendente",
    returned: false,
  },
  {
    id: "patricia-moura",
    name: "Patricia Moura",
    whatsapp: "(41) 99204-7701",
    vehicle: "Fit 2017",
    service: "Troca de oleo",
    exchangeDate: "2026-01-14",
    reminderDate: "2026-04-14",
    daysSinceExchange: 101,
    reminderStatus: "pendente",
    returned: false,
  },
];

export const initialDemoState: DemoState = {
  customers: demoCustomers,
  baseMetrics: initialMetrics,
  selectedCustomerId: demoCustomers[0].id,
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateDaysSince(value: string) {
  const start = new Date(`${value}T12:00:00`).getTime();
  const end = new Date(`${todayIso()}T12:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function createCustomer(input: NewDemoCustomer): DemoCustomer {
  const exchangeDate = input.exchangeDate || todayIso();

  return {
    id: `cliente-${Date.now()}`,
    name: input.name.trim(),
    whatsapp: input.whatsapp.trim(),
    vehicle: input.vehicle.trim(),
    service: input.service.trim() || "Troca de oleo",
    exchangeDate,
    reminderDate: addDaysIso(exchangeDate, 90),
    daysSinceExchange: calculateDaysSince(exchangeDate),
    reminderStatus: "pendente",
    returned: false,
  };
}

export function deriveMetrics(state: DemoState): DemoMetrics {
  const extraCustomers = Math.max(
    0,
    state.customers.length - initialDemoState.customers.length,
  );
  const sentInDemo = state.customers.filter(
    (customer) => {
      if (customer.reminderStatus === "pendente") return false;
      const seed = initialDemoState.customers.find(
        (initialCustomer) => initialCustomer.id === customer.id,
      );
      return !seed || seed.reminderStatus === "pendente";
    },
  ).length;
  const returnsInDemo = state.customers.filter(
    (customer) =>
      customer.returned &&
      !initialDemoState.customers.find((seed) => seed.id === customer.id)
        ?.returned,
  ).length;
  const revenueInDemo = state.customers.reduce((total, customer) => {
    const wasReturned = initialDemoState.customers.find(
      (seed) => seed.id === customer.id,
    )?.returned;
    if (!customer.returned || wasReturned) return total;
    return total + (customer.returnValue ?? demoWorkshop.averageTicket);
  }, 0);

  return {
    registeredCustomers: state.baseMetrics.registeredCustomers + extraCustomers,
    sentReminders: state.baseMetrics.sentReminders + sentInDemo,
    returnedCustomers: state.baseMetrics.returnedCustomers + returnsInDemo,
    generatedRevenue: state.baseMetrics.generatedRevenue + revenueInDemo,
  };
}
