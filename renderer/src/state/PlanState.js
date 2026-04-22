import {
  STORAGE_KEYS,
  readStoredJson,
  writeStoredJson,
  normalizeOrderPlanItem,
  normalizeRoutineItem,
  getOrderPlan,
  saveOrderPlan,
  getRoutineList,
  saveRoutineList,
} from '../shared/storage/LocalJsonStore.js';

export const planState = {
  STORAGE_KEYS,
  readStoredJson,
  writeStoredJson,
  normalizeOrderPlanItem,
  normalizeRoutineItem,
  getOrderPlan,
  saveOrderPlan,
  getRoutineList,
  saveRoutineList,
};

export function createPlanStateStore() {
  return planState;
}
