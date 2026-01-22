import { MercadoPagoConfig, PreApproval, Payment } from "mercadopago";

import { HttpError } from "./errorHandler";

export const createMercadoPagoClient = () => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new HttpError("MERCADOPAGO_ACCESS_TOKEN is not configured.", { status: 500 });
  }

  return new MercadoPagoConfig({ accessToken });
};

export const createPreApprovalClient = () => {
  const client = createMercadoPagoClient();
  return new PreApproval(client);
};

export const createPaymentClient = () => {
  const client = createMercadoPagoClient();
  return new Payment(client);
};
