// Localized copy for transactional emails. EN is the fallback for any missing
// locale/key. Keep strings plain text — the MailService escapes and wraps them.

export type MailLocale = 'en' | 'fr' | 'ar';

export function mailLocale(value?: string | null): MailLocale {
  const v = (value ?? '').slice(0, 2).toLowerCase();
  return v === 'fr' || v === 'ar' ? v : 'en';
}

type Dict = Record<string, string>;

const en: Dict = {
  footerReason: "You're receiving this because you have a hudlgo account.",
  footerPrefs: 'Manage email preferences in',
  footerSettings: 'Settings',
  greeting: 'Hi {{name}},',
  ignore: "If you didn't request this, you can safely ignore this email.",
  linkFallback: "If the button doesn't work, copy and paste this link into your browser:",

  verifySubject: 'Confirm your email for hudlgo',
  verifyHeading: 'Confirm your email',
  verifyBody: 'Tap the button below to confirm this is your email address. Once confirmed you can host and join activities and chat with your group.',
  verifyCta: 'Confirm my email',
  verifyExpiry: 'This link expires in 48 hours.',

  resetSubject: 'Reset your hudlgo password',
  resetHeading: 'Reset your password',
  resetBody: 'We received a request to reset the password for your hudlgo account. Tap the button below to choose a new one.',
  resetBodyNoPassword: 'We received a request to set a password for your hudlgo account (you currently sign in with Google). Tap the button below to choose one.',
  resetCta: 'Choose a new password',
  resetExpiry: 'This link expires in 1 hour and can only be used once.',

  changedSubject: 'Your hudlgo password was changed',
  changedHeading: 'Your password was changed',
  changedBody: 'The password for your hudlgo account was just changed, and you were signed out on all your devices.',
  changedWarn: "If this wasn't you, reset your password right away and contact us by replying to this email.",
  changedCta: 'Log in',

  planEndingSubject: 'Your {{plan}} ends on {{date}}',
  planEndingHeading: 'Your {{plan}} ends soon',
  planEndingBody: 'Your {{plan}} is active until {{date}}. Plans don’t renew automatically: to keep it, send a new payment with a new upgrade request (you’ll get a fresh payment reference).',
  planEndingCta: 'Renew my plan',
};

const fr: Dict = {
  footerReason: 'Tu reçois cet e-mail parce que tu as un compte hudlgo.',
  footerPrefs: 'Gère tes préférences e-mail dans les',
  footerSettings: 'Paramètres',
  greeting: 'Salut {{name}},',
  ignore: "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet e-mail.",
  linkFallback: 'Si le bouton ne fonctionne pas, copie et colle ce lien dans ton navigateur :',

  verifySubject: 'Confirme ton e-mail pour hudlgo',
  verifyHeading: 'Confirme ton adresse e-mail',
  verifyBody: "Appuie sur le bouton ci-dessous pour confirmer qu'il s'agit bien de ton adresse e-mail. Une fois confirmée, tu pourras organiser et rejoindre des activités et discuter avec ton groupe.",
  verifyCta: 'Confirmer mon e-mail',
  verifyExpiry: 'Ce lien expire dans 48 heures.',

  resetSubject: 'Réinitialise ton mot de passe hudlgo',
  resetHeading: 'Réinitialise ton mot de passe',
  resetBody: 'Nous avons reçu une demande de réinitialisation du mot de passe de ton compte hudlgo. Appuie sur le bouton ci-dessous pour en choisir un nouveau.',
  resetBodyNoPassword: 'Nous avons reçu une demande pour définir un mot de passe sur ton compte hudlgo (tu te connectes actuellement avec Google). Appuie sur le bouton ci-dessous pour en choisir un.',
  resetCta: 'Choisir un nouveau mot de passe',
  resetExpiry: "Ce lien expire dans 1 heure et ne peut être utilisé qu'une seule fois.",

  changedSubject: 'Ton mot de passe hudlgo a été modifié',
  changedHeading: 'Ton mot de passe a été modifié',
  changedBody: 'Le mot de passe de ton compte hudlgo vient d’être modifié et tu as été déconnecté de tous tes appareils.',
  changedWarn: "Si ce n'était pas toi, réinitialise ton mot de passe immédiatement et contacte-nous en répondant à cet e-mail.",
  changedCta: 'Se connecter',

  planEndingSubject: 'Ton offre {{plan}} se termine le {{date}}',
  planEndingHeading: 'Ton offre {{plan}} se termine bientôt',
  planEndingBody: 'Ton offre {{plan}} est active jusqu’au {{date}}. Les offres ne se renouvellent pas automatiquement : pour la garder, envoie un nouveau paiement avec une nouvelle demande (tu recevras une nouvelle référence de paiement).',
  planEndingCta: 'Renouveler mon offre',
};

const ar: Dict = {
  footerReason: 'توصلت بهاد الرسالة حيت عندك حساب فـ hudlgo.',
  footerPrefs: 'تقدر تبدل تفضيلات البريد من',
  footerSettings: 'الإعدادات',
  greeting: 'مرحبا {{name}}،',
  ignore: 'إلا ما طلبتيش هادشي، تقدر تتجاهل هاد الرسالة.',
  linkFallback: 'إلا الزر ما خدامش، نسخ هاد الرابط ولصقو فالمتصفح:',

  verifySubject: 'أكّد البريد الإلكتروني ديالك فـ hudlgo',
  verifyHeading: 'أكّد البريد الإلكتروني ديالك',
  verifyBody: 'ضغط على الزر لتحت باش تأكد بلي هادا هو البريد ديالك. من بعد التأكيد تقدر تنظم الأنشطة، تشارك فيها، وتهضر مع المجموعة.',
  verifyCta: 'أكّد البريد ديالي',
  verifyExpiry: 'هاد الرابط كيسالي من بعد 48 ساعة.',

  resetSubject: 'إعادة تعيين كلمة السر ديال hudlgo',
  resetHeading: 'إعادة تعيين كلمة السر',
  resetBody: 'توصلنا بطلب باش تبدل كلمة السر ديال الحساب ديالك فـ hudlgo. ضغط على الزر لتحت باش تختار كلمة سر جديدة.',
  resetBodyNoPassword: 'توصلنا بطلب باش تزيد كلمة سر للحساب ديالك فـ hudlgo (دابا كتدخل بـ Google). ضغط على الزر لتحت باش تختار وحدة.',
  resetCta: 'اختار كلمة سر جديدة',
  resetExpiry: 'هاد الرابط كيسالي من بعد ساعة وحدة وكيتستعمل غير مرة وحدة.',

  changedSubject: 'تبدلات كلمة السر ديالك فـ hudlgo',
  changedHeading: 'تبدلات كلمة السر ديالك',
  changedBody: 'كلمة السر ديال الحساب ديالك فـ hudlgo يالاه تبدلات، وتخرجتي من جميع الأجهزة.',
  changedWarn: 'إلا ماشي نتا، عاود عيّن كلمة السر دغيا وتواصل معانا بالرد على هاد الرسالة.',
  changedCta: 'تسجيل الدخول',

  planEndingSubject: 'العرض {{plan}} ديالك كيسالي نهار {{date}}',
  planEndingHeading: 'العرض {{plan}} ديالك قرب يسالي',
  planEndingBody: 'العرض {{plan}} ديالك خدام حتى {{date}}. العروض ما كيتجددوش بوحدهم: باش تخليه، صيفط خلاص جديد مع طلب جديد (غادي يتعطاك مرجع جديد).',
  planEndingCta: 'جدد العرض ديالي',
};

const DICTS: Record<MailLocale, Dict> = { en, fr, ar };

export function mt(locale: MailLocale, key: string, vars: Record<string, string> = {}): string {
  const raw = DICTS[locale][key] ?? en[key] ?? key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
}
