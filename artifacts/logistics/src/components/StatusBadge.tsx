import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusColor = (s: string) => {
    const l = s.toLowerCase();
    if (l === 'new') return "bg-blue-100 text-blue-800 border-blue-200";
    if (l === 'duplicate flagged' || l === 'duplicate_flagged') return "bg-orange-100 text-orange-800 border-orange-200";
    if (l === 'under review' || l === 'under_review') return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (l === 'confirmed') return "bg-sky-100 text-sky-800 border-sky-200";
    if (l === 'assigned') return "bg-indigo-100 text-indigo-800 border-indigo-200";
    if (l === 'picked for delivery' || l === 'picked_for_delivery') return "bg-violet-100 text-violet-800 border-violet-200";
    if (l === 'out for delivery' || l === 'out_for_delivery') return "bg-purple-100 text-purple-800 border-purple-200";
    if (l === 'delivered') return "bg-green-100 text-green-800 border-green-200";
    if (l === 'partial delivered' || l === 'partial_delivered') return "bg-teal-100 text-teal-800 border-teal-200";
    if (l === 'failed delivery' || l === 'failed_delivery') return "bg-red-100 text-red-800 border-red-200";
    if (l === 'followup') return "bg-amber-100 text-amber-800 border-amber-200";
    if (l === 'reschedule') return "bg-amber-100 text-amber-800 border-amber-200";
    if (l === 'return pending' || l === 'return_pending') return "bg-orange-100 text-orange-800 border-orange-200";
    if (l === 'returned') return "bg-gray-200 text-gray-800 border-gray-300";
    if (l === 'cancelled') return "bg-slate-200 text-slate-800 border-slate-300";
    if (l === 'payment pending' || l === 'payment_pending') return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (l === 'payment released' || l === 'payment_released') return "bg-emerald-100 text-emerald-800 border-emerald-200";
    
    // Default fallback
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium capitalize", getStatusColor(status), className)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
