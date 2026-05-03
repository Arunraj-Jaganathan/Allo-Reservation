import { ReservationClient } from "@/components/ReservationClient";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:pt-12">
      <ReservationClient reservationId={id} />
    </main>
  );
}
