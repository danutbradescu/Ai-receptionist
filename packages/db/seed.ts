import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Începem popularea bazei de date (seed)...');

  const passwordHash = await bcrypt.hash('parola_secreta', 10); // <-- Parolă criptată

  const tenant = await prisma.tenant.upsert({
    where: { email: 'demo@voicero.ro' },
    update: {},
    create: {
      email: 'demo@voicero.ro',
      passwordHash: passwordHash, 
      name: 'Restaurant Demo Craiova',
      plan: 'PRO',
    },
  });
  
  console.log(`✅ Tenant creat: ${tenant.name} (ID: ${tenant.id})`);

  // 2. Creăm sau actualizăm Agentul asociat acestui restaurant
  let agent = await prisma.agent.findFirst({
    where: { tenantId: tenant.id }
  });

  // 👇 AICI PUI ID-URILE TALE DE LA RETELL (lasă ghilimelele) 👇
  const MY_RETELL_AGENT_ID = "agent_ID_UL_TAU_REAL"; 
  const MY_RETELL_LLM_ID = "llm_ID_UL_TAU_REAL";

  if (!agent) {
    // Dacă NU există, îl creăm cu tot cu ID-uri
    agent = await prisma.agent.create({
      data: {
        tenantId: tenant.id,
        name: 'Andra',
        systemPrompt: 'Ești Andra, asistentul vocal al Restaurantului Demo din Craiova. Răspunzi politicos și scurt.',
        retellAgentId: MY_RETELL_AGENT_ID,
        retellLlmId: MY_RETELL_LLM_ID,
      },
    });
    console.log(`✅ Agent creat și legat de Retell: ${agent.name} (ID: ${agent.id})`);
  } else {
    // Dacă EXISTĂ deja, îi facem update la ID-urile noi
    agent = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        retellAgentId: MY_RETELL_AGENT_ID,
        retellLlmId: MY_RETELL_LLM_ID,
      }
    });
    console.log(`✅ Agentul ${agent.name} a fost actualizat cu ID-urile Retell (ID: ${agent.id})`);
  }

  console.log('🎉 Seed complet! Acum avem date pentru platforma multi-client.');
}

main()
  .catch((e) => {
    console.error('❌ Eroare la seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });