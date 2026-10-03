import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

type SectionProps = { title: string; children: React.ReactNode };

function Section({ title, children }: SectionProps) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text style={styles.bulletText}><Text style={styles.bulletLabel}>{label}</Text>{children}</Text></View>;
}

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <ScreenHeader title="Terms and Conditions" />
        <View style={styles.document}>
          <Text style={styles.documentTitle}>SWAG Terms and Conditions</Text>
          <Text style={styles.company}>A'FRO Dry Goods</Text>
          <Text style={styles.updated}>Last updated: September 30, 2026</Text>

          <Section title="1. Acceptance of Terms"><Paragraph>By creating an account, you agree to these Terms and Conditions and our Privacy Policy. You must be 18 or older, or use the app with a parent's or guardian's consent.</Paragraph></Section>

          <Section title="2. Account and Security"><Paragraph>You must provide an accurate email, phone number, and address. You are responsible for your password and your 2FA codes, and for all activity under your account. We may suspend accounts that violate these Terms. If you delete your account, it is deactivated immediately and permanently removed after 30 days. Orders already paid for will still be processed, and disputes on them remain subject to Section 8.</Paragraph></Section>

          <Section title="3. Products and Thrift Items"><Paragraph>Items are second-hand and one-of-a-kind, so each item is available only once and cannot be replaced with an identical one. Stock is limited. Our listings show the photos, description, and measurements of the actual item. Minor wear, flaws, or signs of previous use may exist and are part of buying thrift. Any major defect we are aware of is stated in the listing. If an item is no longer available after you place an order, we will notify you and fully refund any payment you made (see Section 8).</Paragraph></Section>

          <Section title="4. Virtual Try-On (SWAG-VTON) Disclaimer"><Paragraph>Try-on results are 2D, AI-generated visualizations and are not exact representations of fit, color, or fabric. The fit report is an estimate based on the measurements you enter. Accuracy depends on photo quality and body proportions. Please check the listed product measurements before buying. A try-on result is not a basis for a dispute, refund, or complaint about fit. Saved or shared try-on images are AI-generated previews, and you are responsible for how you share them.</Paragraph></Section>

          <Section title="5. SWAG Tone AI Disclaimer"><Paragraph>Color recommendations are general guidance based on a detected skin tone. Results vary with lighting, filters, makeup, and photo quality. They are not a professional color analysis and are not a basis for a dispute or refund.</Paragraph></Section>

          <Section title="6. User Photos and Try-On Results">
            <Bullet label="Processing. ">When you use Virtual Try-On or SWAG Tone AI, the photo you upload or capture is sent to the SWAG servers, operated by the SWAG development team, solely to generate your result on your request.</Bullet>
            <Bullet label="Your results. ">The generated result is returned only to you. We do not publish it, share it with other users, or use it for advertising. You may save it to your device, and you decide whether to share it through the app's social sharing feature.</Bullet>
            <Bullet label="Retention. ">We do not keep your photos or try-on results. Temporary files used during processing are deleted once your result has been delivered. Because we do not keep results, we cannot recover them. Save a result to your device if you want to keep it.</Bullet>
            <Bullet label="Use limits. ">We use your photos only to provide these features. We do not sell them or share them with third parties, except service providers needed to run the app.</Bullet>
            <Bullet label="Your responsibility. ">Only upload photos of yourself, or photos you have permission to use. Reviews and chat messages must not be offensive, unlawful, or misleading.</Bullet>
          </Section>

          <Section title="7. Orders, Payment, Vouchers, and Shipping">
            <Bullet label="Payment. ">Payment is manual through GCash only, with receipt upload and reference number. An order is confirmed only after the admin verifies your payment. If the receipt or reference number cannot be verified, the order is not confirmed.</Bullet>
            <Bullet label="Vouchers. ">Only one voucher can be used per order. Vouchers cannot be combined, have no cash value, and cannot be transferred. Each voucher has a minimum spend and an expiry date shown in the app. A voucher applies to the item subtotal only, not to shipping. A voucher used on an order that is cancelled before payment verification is restored if it has not expired. We may cancel vouchers or orders involving misuse or fake accounts.</Bullet>
            <Bullet label="Shipping fee. ">The shipping fee depends on the total size and weight of the items in your order. Each parcel has a standard size and weight limit [state the limits]. If your items exceed one parcel's limit, they are packed into additional parcels, and the same shipping fee applies for each additional parcel. The total shipping fee is shown at checkout before you pay.</Bullet>
          </Section>

          <Section title="8. Cancellations, Returns, and Disputes">
            <Bullet label="Cancellations. ">You may cancel an order before your payment is verified by the admin. Once payment is verified and the order is being prepared, it can no longer be cancelled.</Bullet>
            <Bullet label="Unavailable items. ">If a verified order cannot be fulfilled because the item is sold out or no longer available, you will receive a full refund, including the shipping fee.</Bullet>
            <Bullet label="No returns or exchanges. ">Because every item is second-hand and one-of-a-kind, we do not accept returns or exchanges for change of mind, fit, color, style, or minor flaws.</Bullet>
            <Bullet label="Disputes. ">You may file a dispute only if the item you received is (a) a different item from the one you ordered, (b) damaged in transit, or (c) materially different from its listing, including an undisclosed major defect. Contact the shop owner through Chat Support in the app within 3 days of the delivery date shown by the courier. Include your order number and clear photos or a video of the item, the parcel, and the shipping label. Disputes filed after this period or without this evidence will not be accepted.</Bullet>
            <Bullet label="Resolution. ">The shop owner will review your dispute and reply within 3 to 5 business days. For a different item or an item unavailable after payment, you will receive a full refund. For damage in transit or a material difference from the listing, the outcome may be a partial or full refund depending on the findings. No refund will be given when the item matches its listing, or the issue is a minor flaw or normal sign of previous use. Replacement is not available because items are one-of-a-kind. The shop owner's decision is final within the app, but this does not limit any rights you have under Philippine law.</Bullet>
          </Section>

          <Section title="9. Shipping and Delivery"><Paragraph>Delivery estimates are not guaranteed. You are responsible for providing a correct address and a reachable phone number. Delays, failed deliveries, or returns to sender caused by an incorrect address or an unreachable number are your responsibility, and additional shipping costs may be charged to you.</Paragraph></Section>

          <Section title="10. SMS and Email Notifications"><Paragraph>You consent to receive verification codes and order updates by SMS and email. SMS may not reach Smart and TNT numbers.</Paragraph></Section>

          <Section title="11. Acceptable Use"><Paragraph>You agree not to create fake accounts, abuse vouchers, hack or reverse-engineer the app, upload other people's photos without consent, file false disputes, or harass the shop or other users. We may suspend or remove accounts that do.</Paragraph></Section>

          <Section title="12. Intellectual Property and Open-Source Credits"><Paragraph>The app, logo, and product photos belong to A'FRO Dry Goods and the developers. This app uses FASHN VTON v1.5 (Apache License 2.0, Copyright 2025 FASHN AI) and SkinToneClassifier (stone) by ChenglongMa (GPL-3.0).</Paragraph></Section>

          <Section title="13. Limitation of Liability"><Paragraph>The app is provided "as is." To the extent allowed by law, A'FRO Dry Goods and the SWAG development team are not liable for dissatisfaction caused by the limits of AI-generated previews, or for service interruptions. This does not limit our responsibility for refunds under Section 8 or any liability that cannot be excluded under Philippine law.</Paragraph></Section>

          <Section title="14. Changes to the Terms"><Paragraph>We may update these Terms. Changes apply to orders placed after the update, and continued use of the app means you accept them.</Paragraph></Section>

          <Section title="15. Governing Law and Contact"><Paragraph>These Terms are governed by the laws of the Republic of the Philippines. Any dispute will be brought before the proper courts of Quezon City. For questions, order concerns, or requests about your personal data (including deletion), contact A'FRO Dry Goods and the SWAG development team through Chat Support or the Help Center in the Settings page of the app, at swagvton@gmail.com, or at 7 Bristol St, Novaliches, Quezon City, 1121 Metro Manila. We aim to respond within 3 to 5 business days.</Paragraph></Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.md, paddingBottom: Spacing['2xl'] },
  document: { backgroundColor: Colors.bg.card, borderColor: Colors.border.default, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  documentTitle: { color: Colors.text.primary, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  company: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '700', marginTop: Spacing.xs, textAlign: 'center' },
  updated: { color: Colors.text.secondary, fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center' },
  section: { marginTop: Spacing.lg },
  sectionTitle: { color: Colors.text.primary, fontSize: FontSize.md, fontWeight: '900', lineHeight: 23, marginBottom: Spacing.sm },
  paragraph: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 21 },
  bullet: { flexDirection: 'row', marginBottom: Spacing.sm, paddingRight: Spacing.xs },
  bulletMark: { color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 21, marginRight: Spacing.sm },
  bulletText: { color: Colors.text.secondary, flex: 1, fontSize: FontSize.sm, lineHeight: 21 },
  bulletLabel: { color: Colors.text.primary, fontStyle: 'italic', fontWeight: '700' },
});
