import Fastify from 'fastify';
import cors from '@fastify/cors';
import Retell from 'retell-sdk';
import { prisma } from '@voltera/db';
import * as dotenv from 'dotenv';
import { buildSystemPrompt } from './services/promptBuilder';
import authPlugin from './plugins/auth';
import registerRoute from './routes/auth/register';
import loginRoute from './routes/auth/login';


dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(authPlugin);
fastify.register(registerRoute, { prefix: '/api/auth' });
fastify.register(loginRoute, { prefix: '/api/auth' });

// Inițializăm SDK-ul Retell folosind cheia din .env
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY as string,
});

// Permitem frontend-ului să comunice cu API-ul nostru
fastify.register(cors, { origin: '*' });

// 1. Endpoint de test - Verificăm DB-ul
fastify.get('/api/test-db', async (request, reply) => {
  const agents = await prisma.agent.findMany();
  return { status: 'succes', database_agents: agents };
});

// 2. Endpoint pentru crearea unui apel Web (Pentru testare fără număr de telefon)
fastify.post('/api/call/web-token', async (request, reply) => {
  try {
    // Aici introduci Agent ID-ul copiat de la Pasul 1
    const RETELL_AGENT_ID = "agent_badbbe341a6cf4bee00c2d3401"; 

    // Cerem de la Retell un token pentru a porni un apel din browser
    const webCallResponse = await retell.call.createWebCall({
      agent_id: RETELL_AGENT_ID,
    });

    return { 
      status: 'succes', 
      access_token: webCallResponse.access_token,
      call_id: webCallResponse.call_id
    };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Nu am putut genera token-ul de apel." });
  }
});

fastify.post('/api/agent/update-prompt', async (request, reply) => {
  try {
    // 1. Luăm agentul și restaurantul din DB (folosim ce am populat cu 'seed')
    const agent = await prisma.agent.findFirst({
      include: { tenant: true }
    });

    if (!agent || !agent.tenant) {
      return reply.status(404).send({ error: "Agentul sau restaurantul nu există în DB." });
    }

    // 2. Generăm noul "creier"
    const newPrompt = buildSystemPrompt(agent, agent.tenant);

    // 3. Trimitem noul prompt către Retell (Actualizează cu Agent ID-ul tău real)
    const RETELL_AGENT_ID = "agent_badbbe341a6cf4bee00c2d3401"; 
    
    await retell.agent.update(RETELL_AGENT_ID, {
      agent_name: agent.name,
      system_prompt: newPrompt
    });

    // 4. Salvăm și în baza noastră de date ca să fim sincronizați
    await prisma.agent.update({
      where: { id: agent.id },
      data: { systemPrompt: newPrompt }
    });

    return { status: 'succes', message: `Prompt actualizat pentru ${agent.name} la ${agent.tenant.name}!` };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Nu am putut actualiza promptul în Retell." });
  }
});

fastify.post('/api/webhook/book-appointment', async (request, reply) => {
  const body = request.body as any;
  
  // Retell trimite datele direct in body daca e setat ca Custom Tool
  // Verificam unde se afla numele, data si ora
  const clientName = body.name || body.args?.name || "Client Necunoscut";
  const appointmentDate = body.date || body.args?.date;
  const appointmentTime = body.time || body.args?.time;

  try {
    const tenant = await prisma.tenant.findFirst({ where: { email: 'demo@voicero.ro' } });

    const newBooking = await prisma.booking.create({
      data: {
        tenantId: tenant!.id,
        clientName: clientName, // Folosim variabila corectata
        date: String(appointmentDate),
        time: String(appointmentTime),
      }
    });

    console.log(`✅ [CALENDAR] Succes! Programare salvată pentru: ${clientName}`);
    return { status: "success", message: "Programarea a fost înregistrată." };
  } catch (error) {
    return reply.code(200).send({ status: "error", message: "Eroare la baza de date." });
  }
});

// 4. Webhook pentru a prinde datele post-apel de la Retell (Task 6)
fastify.post('/api/webhooks/retell', async (request, reply) => {
  try {
    const payload = request.body as any;

    // Retell trimite mai multe evenimente. Ne interesează "call_analyzed" (când e gata rezumatul)
    if (payload.event === 'call_analyzed') {
      const callData = payload.call; // Datele apelului
      
      fastify.log.info(`📞 Apel finalizat recepționat! ID: ${callData.call_id}`);
      
      // Căutăm agentul în baza de date ca să știm de ce restaurant aparține
      const agent = await prisma.agent.findFirst();

      if (agent) {
        // Salvăm înregistrarea în baza noastră de date
        await prisma.call.create({
          data: {
            tenantId: agent.tenantId,
            agentId: agent.id,
            status: 'COMPLETED',
            transcript: callData.transcript,
            summary: callData.call_analysis?.call_summary || "Fără rezumat",
            recordingUrl: callData.recording_url
          }
        });
        fastify.log.info(' <> Datele apelului au fost salvate cu succes în DB!');
      }
    } else {
      fastify.log.info(`Am primit un eveniment de la Retell: ${payload.event}`);
    }

    // Trebuie mereu să răspundem cu 200 OK, altfel Retell crede că a picat serverul
    return reply.status(200).send({ received: true });
  } catch (error) {
    fastify.log.error(error, 'Eroare la procesarea webhook-ului:'); 
    return reply.status(500).send({ error: 'Eroare internă webhook' });
  }
});

fastify.get('/api/analytics/stats', async (request, reply) => {
  try {
    await request.jwtVerify();
    const decoded = request.user as { tenantId: string };

    const totalCalls = await prisma.call.count({
      where: { tenantId: decoded.tenantId }
    });

    // Calculăm durata medie (simulat sau din DB dacă ai câmpul duration)
    // Momentan punem niste cifre "frumoase" pentru demo
    return {
      totalCalls,
      avgDuration: "2m 15s",
      successRate: "92%",
      activeMinutes: "145 min"
    };
  } catch (err) {
    return reply.code(401).send({ error: "Neautorizat" });
  }
});

// Adaugă asta în server.ts lângă celelalte rute
fastify.get('/api/analytics/dashboard', async (request, reply) => {
  try {
    await request.jwtVerify();
    const { tenantId } = request.user as { tenantId: string };

    // 1. Total Apeluri
    const totalCalls = await prisma.call.count({ where: { tenantId } });

    // 2. Ultimele 5 apeluri (Activitate Recentă)
    const recentCalls = await prisma.call.findMany({
      where: { tenantId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, createdAt: true, summary: true }
    });

    // 3. Date pentru Grafic (Ultimele 7 zile)
    // Nota: Aici facem o simulare inteligenta bazata pe DB pentru demo
    // Intr-un sistem de productie, am folosi un query de tip "groupBy" pe data
    const chartData = [
      { name: 'Lun', apeluri: Math.floor(Math.random() * 10) + 2 },
      { name: 'Mar', apeluri: Math.floor(Math.random() * 15) + 5 },
      { name: 'Mie', apeluri: totalCalls > 0 ? totalCalls : 3 },
      { name: 'Joi', apeluri: 8 },
      { name: 'Vin', apeluri: 12 },
      { name: 'Sâm', apeluri: 4 },
      { name: 'Dum', apeluri: 2 },
    ];

    return {
      stats: {
        totalCalls,
        avgDuration: "2m 45s",
        successRate: "94%",
        activeMinutes: Math.floor(totalCalls * 2.5) // estimare
      },
      chartData,
      recentCalls
    };
  } catch (err) {
    return reply.code(401).send({ error: "Sesiune expirată" });
  }
});

fastify.get('/api/calls', async (request, reply) => {
  try {
    await request.jwtVerify();
    const { tenantId } = request.user as { tenantId: string };

    const calls = await prisma.call.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { name: true } }
      }
    });

    return calls;
  } catch (err) {
    return reply.code(401).send({ error: "Sesiune expirată" });
  }
});

// Actualizare setări agent (Prompt direct din Dashboard)
fastify.patch('/api/agent', async (request, reply) => {
  const { prompt, retellAgentId, retellLlmId } = request.body as { 
    prompt: string, 
    retellAgentId?: string, 
    retellLlmId?: string 
  };
  
  try {
    await request.jwtVerify();
    const decoded = request.user as { tenantId: string };

    // 1. Căutăm agentul clientului
    const agent = await prisma.agent.findFirst({
      where: { tenantId: decoded.tenantId }
    });

    if (!agent) return reply.code(404).send({ error: 'Agent negăsit' });

    // 2. Actualizăm ID-urile în baza noastră de date (dacă au fost trimise)
    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: { 
        systemPrompt: prompt,
        retellAgentId: retellAgentId || agent.retellAgentId,
        retellLlmId: retellLlmId || agent.retellLlmId
      }
    });

    // 3. DOAR DACĂ avem un LLM ID valid, încercăm să sincronizăm cu Retell
    if (updatedAgent.retellLlmId && updatedAgent.retellLlmId !== "agent_ID_UL_TAU_REAL") {
      await retell.llm.update(updatedAgent.retellLlmId, {
        general_prompt: prompt,
      });
    }

    return { success: true, message: 'Configurare salvată!' };
  } catch (error: any) {
    fastify.log.error(error);
    return reply.code(500).send({ error: 'Eroare la salvare: ' + error.message });
  }
});


const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await fastify.listen({ port });
    console.log(`🚀 VoiceRO API a pornit cu succes pe http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};


start();