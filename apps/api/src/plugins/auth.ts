import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

export default fp(async function (fastify, opts) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'secretul_meu_foarte_lung_pentru_jwt_123',
    cookie: {
      cookieName: 'voicero_token', // Numele pe care l-am pus în login.ts
      signed: false, // Setăm pe true doar dacă am semnat cookie-ul în server.ts
    },
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Acum jwtVerify va verifica automat și cookie-ul conform setărilor de mai sus
      await request.jwtVerify();
    } catch (err) {
      // Dacă token-ul lipsește sau e invalid, returnăm 401 clar
      reply.status(401).send({ error: 'Sesiune expirată sau invalidă' });
    }
  });
});