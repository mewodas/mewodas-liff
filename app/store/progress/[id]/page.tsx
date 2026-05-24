import { redirect } from 'next/navigation';
export default function StoreProgressDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/store/analysis?customer=${params.id}`);
}
