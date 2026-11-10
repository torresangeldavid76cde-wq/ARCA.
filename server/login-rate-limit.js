import rateLimit from 'express-rate-limit';

export function createLoginRateLimit(){
  return rateLimit({
    windowMs:15*60e3,
    limit:30,
    standardHeaders:true,
    legacyHeaders:false,
    skipSuccessfulRequests:true,
    message:{error:'Demasiados intentos de inicio de sesión. Espera 15 minutos antes de volver a intentarlo.'}
  });
}
