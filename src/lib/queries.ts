import { queryOptions } from "@tanstack/react-query";
import {
  getOverview,
  getSpendingSummary,
  listLetters,
  listPayees,
  listTransactions,
} from "./bank.functions";

export const overviewQuery = () =>
  queryOptions({ queryKey: ["overview"], queryFn: () => getOverview() });

export const transactionsQuery = () =>
  queryOptions({ queryKey: ["transactions"], queryFn: () => listTransactions() });

export const lettersQuery = () =>
  queryOptions({ queryKey: ["letters"], queryFn: () => listLetters() });

export const payeesQuery = () =>
  queryOptions({ queryKey: ["payees"], queryFn: () => listPayees() });

export const spendingQuery = () =>
  queryOptions({ queryKey: ["spending"], queryFn: () => getSpendingSummary() });
