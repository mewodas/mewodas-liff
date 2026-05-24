import { redirect } from 'next/navigation';
export default function AdminProgressDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/analysis?customer=${params.id}`);
}
