import { Link } from "react-router-dom";
import { OrbitLogo } from "@/components/OrbitLogo";

const PAGES = {
  terms: {
    title: "Terms of Service",
    testid: "legal-terms",
    sections: [
      ["Service", "ORBIT provides a managed AI-employee platform. We configure, host the customer dashboard, meter usage and bill according to the rates agreed for your account. Underlying voice, telephony and messaging infrastructure is operated by ORBIT through specialised providers. You are buying an ORBIT managed service, not a licence to operate those providers yourself."],
      ["Accounts", "You must keep login credentials confidential. You are responsible for activity under your workspace. Platform administrators may suspend an account that poses security, billing or legal risk."],
      ["Acceptable use", "You must not use the service for unlawful, deceptive or harmful communications. You must not present an AI employee as a human. You remain responsible for any outbound calling or messaging consents required in your jurisdiction."],
      ["Usage and billing", "Charges are based on metered usage (for example voice minutes and messages) plus any platform fees and applicable tax, as shown on your invoices. Estimates in the dashboard are not final invoices. Hard usage caps, where configured, may suspend new billable activity."],
      ["Managed configuration", "Prompts, knowledge, tools, voice behaviour and channel wiring are managed by ORBIT. Change requests are submitted through the workspace and completed by our team."],
      ["Availability", "We aim for continuous operation but do not guarantee uninterrupted service. Provider outages may temporarily make voice, phone, WhatsApp or payments unavailable."],
      ["Limitation of liability", "To the extent permitted by law, ORBIT is not liable for indirect or consequential loss, or for decisions made by end customers based on AI responses. Our liability is limited to fees paid for the affected billing period."],
      ["Changes", "We may update these terms. Continued use after notice constitutes acceptance. For questions, contact the ORBIT team through your workspace."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    testid: "legal-privacy",
    sections: [
      ["Who we are", "ORBIT operates the multi-tenant AI-employee platform you log into. This policy describes how we handle business-account data and conversation records."],
      ["Data we process", "Account details (name, email, business profile), configuration needed to run your AI employee, conversation metadata, transcripts and recording references where enabled, usage events, and invoices. We do not put provider API keys in the browser."],
      ["Why we process it", "To provide the service, isolate each tenant's data, meter usage, generate invoices, improve reliability, and meet legal obligations."],
      ["Providers", "Voice, telephony, messaging and payment processing may be performed by infrastructure providers acting on ORBIT's instructions. Conversation content may be processed by those systems to complete a call or message. We do not sell your customer lists."],
      ["Isolation", "Each business workspace is tenant-scoped. Other customers cannot access your conversations, users or invoices through the product."],
      ["Retention", "Conversation, transcript and billing records are retained as needed to operate the service and invoices. Contact ORBIT if you need a specific retention arrangement."],
      ["Your rights", "Workspace owners can view and update permitted profile fields in Settings. For access, correction or deletion requests that cannot be self-served, contact ORBIT."],
      ["Contact", "Privacy requests can be raised through your ORBIT workspace or the account email on file."],
    ],
  },
  disclosure: {
    title: "AI & recording disclosure",
    testid: "legal-disclosure",
    sections: [
      ["You are speaking with AI", "ORBIT AI employees are artificial-intelligence assistants, not human staff. Callers and chat users must be able to understand that they are interacting with AI before or at the start of the conversation, as required by applicable law and provider terms."],
      ["Recordings and transcripts", "Conversations may be recorded, transcribed and summarised so the business can review activity, train approved behaviour through ORBIT's managed service, meter usage and meet support or legal needs."],
      ["Who may process a conversation", "Audio, text and related metadata may be processed by ORBIT and by the voice, telephony, messaging or language-model infrastructure used to deliver the service."],
      ["Customer responsibility", "The business that deploys an AI employee is responsible for any additional notices, consents or recordings required for outbound calls or local regulation. ORBIT does not make the AI claim to be human."],
      ["In the product", "The customer dashboard shows conversation summaries and transcripts for that business only. Provider credentials and internal agent identifiers are not shown to customers."],
    ],
  },
};

export default function Legal({ page }) {
  const doc = PAGES[page] || PAGES.terms;
  return (
    <div className="min-h-screen bg-white text-zinc-900" data-testid={doc.testid}>
      <header className="border-b border-black/5">
        <nav className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <OrbitLogo className="w-7 h-7 text-zinc-900" />
            <span className="font-display font-semibold">ORBIT</span>
          </Link>
          <Link to="/login" className="text-sm text-zinc-500 hover:text-zinc-900">Sign in</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-3 text-sm text-zinc-500">Effective for the ORBIT managed AI-employee service.</p>
        <div className="mt-10 space-y-8">
          {doc.sections.map(([h, p]) => (
            <section key={h}>
              <h2 className="font-display text-lg font-semibold">{h}</h2>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{p}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-xs text-zinc-400">
          <Link to="/terms" className="hover:text-zinc-700">Terms</Link>
          {" · "}
          <Link to="/privacy" className="hover:text-zinc-700">Privacy</Link>
          {" · "}
          <Link to="/ai-disclosure" className="hover:text-zinc-700">AI disclosure</Link>
        </p>
      </main>
    </div>
  );
}
