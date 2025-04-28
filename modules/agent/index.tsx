import EntityComponent from '@/shared/components/entity';
import { trpcApi } from '@/shared/utils/trpc/trpc';
import { redirect } from 'next/navigation';

import { checkUserSession } from '@/shared/utils/auth-helpers/server';
import AgentPlayground from './components/agent-playground';

const Agent = async ({ id }: { id: string }) => {
  await checkUserSession();

  const agent = await trpcApi.explorer.getAgentById.query(id);
  if (!agent) {
    redirect('/404');
  }
  const tags = agent?.tags?.split(',') || [];
  const usecases = (agent?.use_cases ?? []) as {
    title: string;
    description: string;
  }[];

  const requirements = (agent?.requirements ?? []) as {
    package: string;
    installation: string;
  }[];

  return (
    <EntityComponent
      title="Agent"
      tags={tags}
      id={id}
      usecases={usecases}
      imageUrl={agent.image_url ?? ''}
      description={agent.description ?? ''}
      name={agent.name ?? ''}
      requirements={requirements}
      userId={agent.user_id ?? ''}
    >
      <AgentPlayground
        language={agent.language ?? ''}
        agent={agent.agent ?? ''}
      />
    </EntityComponent>
  );
};

export default Agent;
