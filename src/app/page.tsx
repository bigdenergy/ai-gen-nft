// app/page.tsx
import ProjectForm from '@/components/ProjectForm';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Create a New NFT Project</h1>
      <ProjectForm />
    </div>
  );
}