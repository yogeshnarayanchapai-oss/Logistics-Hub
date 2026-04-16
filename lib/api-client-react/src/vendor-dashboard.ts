import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface VendorComment {
  sno: number;
  id: number;
  orderId: number;
  orderCode: string;
  comment: string;
  addedOn: string;
}

export const getListVendorCommentsQueryKey = () => ["/api/dashboard/vendor-comments"] as const;

export function useListVendorComments<TData = VendorComment[]>(
  options?: { query?: UseQueryOptions<VendorComment[], unknown, TData> }
) {
  return useQuery<VendorComment[], unknown, TData>({
    queryKey: options?.query?.queryKey ?? getListVendorCommentsQueryKey(),
    queryFn: () => customFetch<VendorComment[]>("/api/dashboard/vendor-comments", { method: "GET" }),
    ...options?.query,
  });
}
