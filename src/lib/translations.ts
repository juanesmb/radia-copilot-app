export type Language = "en" | "es";

type TranslationRecord = Record<string, string>;

type TranslationMap = Record<Language, TranslationRecord>;

export const translations: TranslationMap = {
  en: {
    "app.title": "Record Your Analysis",
    "app.subtitle":
      "Dictate your findings, edit the transcription, and let AI draft a clean report.",
    "app.generate": "Generate report",
    "app.generateBusy": "Generating...",
    "app.generatedToast": "Report ready",

    "language.switcherLabel": "Language",
    "language.english": "English",
    "language.spanish": "Spanish",

    "input.label": "Transcription",
    "input.placeholder": "Use your device dictation feature or paste your notes here...",
    "input.hint": "Tip: enable your OS dictation shortcut for a faster workflow.",

    "report.title": "Report preview",
    "report.studyTitle": "Study Title",
    "report.findings": "Findings",
    "report.results": "Results",
    "report.impression": "Impression",
    "report.empty": "The generated report will appear here.",
    "report.copy": "Copy to clipboard",
    "report.copied": "Report copied",

    "errors.generic": "We could not generate the report. Please try again.",
    "errors.requestFailed": "Unable to contact the report service.",
    "errors.validation.transcriptionRequired":
      "Please add a transcription before generating.",
  },
  es: {
    "app.title": "Graba tu Análisis",
    "app.subtitle":
      "Dicta tus hallazgos, edita la transcripción y deja que la IA redacte un informe limpio.",
    "app.generate": "Generar informe",
    "app.generateBusy": "Generando...",
    "app.generatedToast": "Informe listo",

    "language.switcherLabel": "Idioma",
    "language.english": "Inglés",
    "language.spanish": "Español",

    "input.label": "Transcripción",
    "input.placeholder":
      "Usa la función de dictado de tu dispositivo o pega tus notas aquí...",
    "input.hint":
      "Tip: activa el atajo de dictado de tu sistema operativo para trabajar más rápido.",

    "report.title": "Vista previa del informe",
    "report.studyTitle": "Título del Estudio",
    "report.findings": "Hallazgos",
    "report.results": "Resultados",
    "report.impression": "Impresión",
    "report.empty": "El informe generado aparecerá aquí.",
    "report.copy": "Copiar al portapapeles",
    "report.copied": "Informe copiado",

    "errors.generic": "No pudimos generar el informe. Intenta nuevamente.",
    "errors.requestFailed": "No pudimos contactar el servicio de informes.",
    "errors.validation.transcriptionRequired":
      "Agrega una transcripción antes de generar.",
  },
};

