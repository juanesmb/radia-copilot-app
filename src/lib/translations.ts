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
    "report.impression": "Impression",
    "report.date": "Date",
    "report.template": "Template",
    "report.transcription": "Transcription",
    "report.transcriptionEmpty": "No transcription available.",
    "report.empty": "The generated report will appear here.",
    "report.copy": "Copy to clipboard",
    "report.copied": "Report copied",
    "report.disclaimer": "This report has been generated using AI and may contain errors. Always verify the information.",

    "reports.title": "Reports",
    "reports.generate": "Generate report",
    "reports.empty": "No reports generated yet.",

    "recording.title": "Record Your Analysis",
    "recording.description":
      "Click the microphone to start recording your verbal findings. Speak naturally as you would during a case review.",
    "recording.placeholder": "Dictate or paste your transcription...",
    "recording.label": "Dictation",
    "recording.upload": "Generate report",
    "recording.recording": "Recording...",
    "recording.connecting": "Connecting...",
    "recording.stop": "Stop",
    "recording.studyType": "Study Type",
    "recording.detecting": "Detecting study type...",

    "upload.title": "Processing transcription",
    "upload.subtitle": "Generating structured findings and impression",
    "upload.status1": "Analyzing study context",
    "upload.status2": "Structuring findings",
    "upload.status3": "Preparing impression",
    "upload.complete": "Ready!",

    "welcome.tagline": "AI Radiology Assistant",
    "welcome.title": "Record, review, and share structured reports",
    "welcome.subtitle":
      "Transcribe your studies, edit the structured output, and collaborate with your care team in seconds.",
    "welcome.generate": "Generate report",
    "welcome.viewReports": "View history",

    "errors.generic": "We could not generate the report. Please try again.",
    "errors.requestFailed": "Unable to contact the report service.",
    "errors.validation.transcriptionRequired":
      "Please add a transcription before generating.",
    "errors.microphoneAccess": "Could not access microphone. Please check permissions.",

    "studyType.ct-abdomen": "CT Abdomen",
    "studyType.ct-abdomen-withoutContrast": "CT Abdomen (No Contrast)",
    "studyType.ct-ankle": "CT Ankle",
    "studyType.ct-brain": "CT Brain",
    "studyType.ct-chest": "CT Chest",
    "studyType.ct-chest-withoutContrast": "CT Chest (No Contrast)",
    "studyType.ct-ear": "CT Ear",
    "studyType.ct-facial": "CT Facial",
    "studyType.ct-hip": "CT Hip",
    "studyType.ct-neck": "CT Neck",
    "studyType.ct-orbit": "CT Orbit",
    "studyType.ct-spine-cervical": "CT Cervical Spine",
    "studyType.ct-spine-dorsolumbar": "CT Dorsolumbar Spine",
    "studyType.ct-uro": "CT Urography",
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
    "report.impression": "Conclusión",
    "report.date": "Fecha",
    "report.template": "Plantilla",
    "report.transcription": "Transcripción",
    "report.transcriptionEmpty": "No hay transcripción disponible.",
    "report.empty": "El informe generado aparecerá aquí.",
    "report.copy": "Copiar al portapapeles",
    "report.copied": "Informe copiado",
    "report.disclaimer": "Este reporte ha sido generado usando IA y puede contener errores. Siempre verifica la información.",

    "reports.title": "Informes",
    "reports.generate": "Generar informe",
    "reports.empty": "Todavía no se han generado informes.",

    "recording.title": "Graba tu Análisis",
    "recording.description":
      "Haz clic en el micrófono para comenzar a grabar tus hallazgos. Habla con naturalidad como lo harías durante la revisión del caso.",
    "recording.placeholder": "Dicta o escribe tu transcripción...",
    "recording.label": "Dictado",
    "recording.upload": "Generar informe",
    "recording.recording": "Grabando...",
    "recording.connecting": "Conectando...",
    "recording.stop": "Detener",
    "recording.studyType": "Tipo de estudio",
    "recording.detecting": "Detectando tipo de estudio...",

    "upload.title": "Procesando transcripción",
    "upload.subtitle": "Generando hallazgos y conclusión estructurados",
    "upload.status1": "Analizando el contexto del estudio",
    "upload.status2": "Organizando los hallazgos",
    "upload.status3": "Preparando la conclusión",
    "upload.complete": "¡Listo!",

    "welcome.tagline": "Asistente de Radiología con IA",
    "welcome.title": "Graba, revisa y comparte informes estructurados",
    "welcome.subtitle":
      "Transcribe tus estudios, edita el resultado estructurado y colabora con tu equipo clínico en segundos.",
    "welcome.generate": "Generar informe",
    "welcome.viewReports": "Ver historial",

    "errors.generic": "No pudimos generar el informe. Intenta nuevamente.",
    "errors.requestFailed": "No pudimos contactar el servicio de informes.",
    "errors.validation.transcriptionRequired":
      "Agrega una transcripción antes de generar.",
    "errors.microphoneAccess": "No se pudo acceder al micrófono. Verifica los permisos.",

    "studyType.ct-abdomen": "TC Abdomen",
    "studyType.ct-ankle": "TC Tobillo",
    "studyType.ct-brain": "TC Cerebro",
    "studyType.ct-chest": "TC Tórax",
    "studyType.ct-ear": "TC Oído",
    "studyType.ct-facial": "TC Facial",
    "studyType.ct-hip": "TC Cadera",
    "studyType.ct-neck": "TC Cuello",
    "studyType.ct-orbit": "TC Órbita",
    "studyType.ct-spine-cervical": "TC Columna Cervical",
    "studyType.ct-spine-dorsolumbar": "TC Columna Dorsolumbar",
    "studyType.ct-uro": "TC Urografía",
  },
};

