import { IUnwrapServerActions } from "../types/actions";

export function unwrapActions<T extends Record<string, (...args: any) => any>>(
  actions: T
) {
  let r = {} as any;
  Object.keys(actions).forEach((key) => {
    r[key] = async (...args: any) => {
      // @ts-ignore
      const { data, error } = await actions[key](...args);

      if (error) {
        throw error;
      }

      return data;
    };
  });

  return r as IUnwrapServerActions<T>;
}
