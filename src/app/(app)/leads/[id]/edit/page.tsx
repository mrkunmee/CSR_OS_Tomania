import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "../../lead-form";
import { updateLead } from "../../actions";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { company: true },
  });

  if (!lead) notFound();
  if (user.role === "CSR" && lead.assignedToId !== user.id) notFound();

  return (
    <div>
      <Link href={`/leads/${lead.id}`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Back to lead
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit lead</h1>

      <div className="mt-6">
        <LeadForm action={updateLead} lead={lead} submitLabel="Save changes" />
      </div>
    </div>
  );
}
