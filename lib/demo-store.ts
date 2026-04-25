"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DemoState,
  type NewDemoCustomer,
  createCustomer,
  demoWorkshop,
  deriveMetrics,
  initialDemoState,
  todayIso,
} from "@/lib/demo-data";

const STORAGE_KEY = "quando-trocar-demo-state-v1";

function cloneInitialState(): DemoState {
  return {
    customers: initialDemoState.customers.map((customer) => ({ ...customer })),
    baseMetrics: { ...initialDemoState.baseMetrics },
    selectedCustomerId: initialDemoState.selectedCustomerId,
  };
}

function parseStoredState(value: string | null): DemoState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as DemoState;
    if (!Array.isArray(parsed.customers) || !parsed.baseMetrics) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useDemoStore() {
  const [state, setState] = useState<DemoState>(() => cloneInitialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const metrics = useMemo(() => deriveMetrics(state), [state]);
  const selectedCustomer = useMemo(
    () =>
      state.customers.find(
        (customer) => customer.id === state.selectedCustomerId,
      ) ?? state.customers[0],
    [state.customers, state.selectedCustomerId],
  );

  const registerCustomer = useCallback((input: NewDemoCustomer) => {
    const customer = createCustomer(input);
    setState((current) => ({
      ...current,
      customers: [customer, ...current.customers],
      selectedCustomerId: customer.id,
    }));
    return customer;
  }, []);

  const sendReminder = useCallback((customerId: string) => {
    setState((current) => ({
      ...current,
      selectedCustomerId: customerId,
      customers: current.customers.map((customer) =>
        customer.id === customerId
          ? { ...customer, reminderStatus: "enviado" }
          : customer,
      ),
    }));
  }, []);

  const scheduleCustomer = useCallback((customerId: string) => {
    setState((current) => ({
      ...current,
      selectedCustomerId: customerId,
      customers: current.customers.map((customer) =>
        customer.id === customerId
          ? { ...customer, reminderStatus: "agendado" }
          : customer,
      ),
    }));
  }, []);

  const confirmReturn = useCallback((customerId: string, value?: number) => {
    setState((current) => ({
      ...current,
      selectedCustomerId: customerId,
      customers: current.customers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              reminderStatus: "agendado",
              returned: true,
              returnStatus: "concluido",
              returnDate: todayIso(),
              returnValue: value ?? customer.returnValue ?? demoWorkshop.averageTicket,
            }
          : customer,
      ),
    }));
  }, []);

  const selectCustomer = useCallback((customerId: string) => {
    setState((current) => ({ ...current, selectedCustomerId: customerId }));
  }, []);

  const resetDemo = useCallback(() => {
    const initial = cloneInitialState();
    setState(initial);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    state,
    metrics,
    selectedCustomer,
    hydrated,
    registerCustomer,
    sendReminder,
    scheduleCustomer,
    confirmReturn,
    selectCustomer,
    resetDemo,
  };
}
