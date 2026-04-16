import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface SupportContact {
  id: number;
  name: string;
  department: string;
  phone: string;
  createdAt: string;
}

export interface CreateSupportContactBody {
  name: string;
  department: string;
  phone: string;
}

export interface UpdateSupportContactBody {
  name?: string;
  department?: string;
  phone?: string;
}

export const getListSupportContactsQueryKey = () => ["/api/support-contacts"] as const;

export const listSupportContacts = (options?: RequestInit): Promise<SupportContact[]> =>
  customFetch<SupportContact[]>("/api/support-contacts", { ...options, method: "GET" });

export function useListSupportContacts<TData = SupportContact[]>(
  options?: { query?: UseQueryOptions<SupportContact[], unknown, TData> }
) {
  const queryKey = options?.query?.queryKey ?? getListSupportContactsQueryKey();
  return useQuery<SupportContact[], unknown, TData>({
    queryKey,
    queryFn: () => listSupportContacts(),
    ...options?.query,
  });
}

export function useCreateSupportContact(options?: {
  mutation?: UseMutationOptions<SupportContact, unknown, CreateSupportContactBody>;
}) {
  return useMutation<SupportContact, unknown, CreateSupportContactBody>({
    mutationFn: (data) =>
      customFetch<SupportContact>("/api/support-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useUpdateSupportContact(options?: {
  mutation?: UseMutationOptions<SupportContact, unknown, { id: number; data: UpdateSupportContactBody }>;
}) {
  return useMutation<SupportContact, unknown, { id: number; data: UpdateSupportContactBody }>({
    mutationFn: ({ id, data }) =>
      customFetch<SupportContact>(`/api/support-contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    ...options?.mutation,
  });
}

export function useDeleteSupportContact(options?: {
  mutation?: UseMutationOptions<void, unknown, { id: number }>;
}) {
  return useMutation<void, unknown, { id: number }>({
    mutationFn: ({ id }) =>
      customFetch<void>(`/api/support-contacts/${id}`, { method: "DELETE" }),
    ...options?.mutation,
  });
}
