import { NextRequest, NextResponse } from "next/server";

type Country = "CO" | "AR";

type CountryResponse = {
  country: Country;
  currency: "COP" | "ARS";
  proPrice: number;
};

const normalizeSimulationCountry = (value?: string | null): Country | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (["ar", "arg", "argentina"].includes(v)) return "AR";
  if (["co", "col", "colombia"].includes(v)) return "CO";
  return null;
};

const detectCountryFromHeaders = (request: NextRequest): Country => {
  const simulation = normalizeSimulationCountry(process.env.SIMULATION_COUNTRY);
  if (simulation) return simulation;

  const headerCountry =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country");

  if (headerCountry) {
    const v = headerCountry.trim().toUpperCase();
    if (v === "AR") return "AR";
    if (v === "CO") return "CO";
  }

  return "CO";
};

const getCurrencyByCountry = (country: Country): CountryResponse["currency"] => {
  return country === "AR" ? "ARS" : "COP";
};

const getProPriceByCountry = (country: Country) => {
  if (country === "AR") {
    return Number(process.env.PRO_PRICE_ARS || 0) || 0;
  }
  return 20000;
};

export async function GET(request: NextRequest) {
  const country = detectCountryFromHeaders(request);
  const currency = getCurrencyByCountry(country);
  const proPrice = getProPriceByCountry(country);

  return NextResponse.json(
    {
      country,
      currency,
      proPrice,
    } satisfies CountryResponse,
    { status: 200 }
  );
}
