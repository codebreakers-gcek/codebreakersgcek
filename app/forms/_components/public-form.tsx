/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Calendar as CalendarIcon,
  CreditCard,
  Check,
  Copy,
  Ban,
  QrCode,
  Smartphone,
  Info,
  CheckCircle2,
  XCircle,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { submitFormResponse } from "../actions";
import type { PublishedFormResponse } from "../actions";
import { FormFieldDefinition, BANNER_TEMPLATES } from "@/lib/form-types";
import {
  buildUpiUri,
  generateUpiQrDataUrl,
  parseUpiUri,
  validateUpiUri,
  getUpiAppLinks,
  UpiPaymentConfig,
} from "@/lib/upi";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import ListItem from "@tiptap/extension-list-item";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import TextAlign from "@tiptap/extension-text-align";
import parse from "html-react-parser";
import { FormFileUploader, ProcessedFormFile } from "./form-file-uploader";

interface PublicFormProps {
  form: PublishedFormResponse;
}

function getImageUrl(key?: string | null) {
  if (!key) return "";
  return `https://codebreakers.t3.storage.dev/${key}`;
}

/* ─── CSS ─── */
const FORM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .mf-page {
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    color: #1C1B1F;
    position: relative;
  }

  /* ─── Gradient Banner ─── */
  .mf-banner {
    width: 100%;
    height: 180px;
    position: relative;
    z-index: 0;
  }
  @media (max-width: 640px) {
    .mf-banner { height: 120px; }
  }

  /* ─── Main Card Container ─── */
  .mf-container {
    position: relative;
    z-index: 1;
    max-width: 800px;
    margin: -80px auto 0;
    padding: 0 20px 60px;
  }
  @media (max-width: 640px) {
    .mf-container { margin-top: -50px; padding: 0 12px 40px; }
  }

  .mf-card {
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 40px 48px;
    margin-bottom: 0;
  }
  @media (max-width: 640px) {
    .mf-card { padding: 24px 20px; border-radius: 6px; }
  }

  /* ─── Form Header ─── */
  .mf-brand-header {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: 4px 12px 4px 6px;
    background: #F8F9FA;
    border: 1px solid #E9ECEF;
    border-radius: 9999px;
  }
  .mf-brand-logo-wrap {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .mf-brand-name {
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #1E293B;
    letter-spacing: -0.01em;
  }

  .mf-title {
    font-family: 'Sora', sans-serif;
    font-size: clamp(22px, 4vw, 32px);
    font-weight: 700;
    color: #1C1B1F;
    line-height: 1.3;
    letter-spacing: -0.01em;
    margin: 0 0 16px;
    text-transform: uppercase;
  }
  .mf-description {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 400;
    color: #333;
    line-height: 1.6;
    margin: 0 0 16px;
  }
  .mf-description p {
    margin: 0 0 12px;
    line-height: 1.6;
  }
  .mf-description p:last-child {
    margin-bottom: 0;
  }
  .mf-description strong, .mf-description b {
    font-weight: 700;
    color: #111;
  }
  .mf-description em, .mf-description i {
    font-style: italic;
  }
  .mf-description ul {
    list-style-type: disc;
    padding-left: 22px;
    margin: 8px 0 12px;
  }
  .mf-description ol {
    list-style-type: decimal;
    padding-left: 22px;
    margin: 8px 0 12px;
  }
  .mf-description li {
    margin: 4px 0;
    line-height: 1.5;
  }
  .mf-disclaimer {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: #666;
    line-height: 1.6;
    margin: 0 0 20px;
  }
  .mf-required-notice {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: #333;
    margin: 0;
    padding-top: 16px;
    border-top: 1px solid #e8e8e8;
  }
  .mf-required-notice .mf-asterisk {
    color: #D13438;
    margin-right: 2px;
  }

  /* ─── Question Block ─── */
  .mf-question {
    padding: 32px 0;
  }
  .mf-question + .mf-question {
    border-top: none;
  }
  .mf-question-label {
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1C1B1F;
    margin: 0 0 12px;
    line-height: 1.4;
  }
  .mf-question-label .mf-asterisk {
    color: #D13438;
    font-weight: 600;
    margin-left: 2px;
  }
  .mf-question-desc {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 400;
    color: #666;
    margin: -6px 0 12px;
    line-height: 1.5;
  }
  .mf-question-desc p {
    margin: 0 0 6px;
    line-height: 1.5;
  }
  .mf-question-desc p:last-child {
    margin-bottom: 0;
  }
  .mf-question-desc strong, .mf-question-desc b {
    font-weight: 700;
    color: #333;
  }
  .mf-question-desc em, .mf-question-desc i {
    font-style: italic;
  }
  .mf-question-desc ul {
    list-style-type: disc;
    padding-left: 20px;
    margin: 4px 0 8px;
  }
  .mf-question-desc ol {
    list-style-type: decimal;
    padding-left: 20px;
    margin: 4px 0 8px;
  }
  .mf-question-desc li {
    margin: 2px 0;
  }

  /* ─── Inputs ─── */
  .mf-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid #D2D0CA;
    outline: none;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    color: #1C1B1F;
    padding: 10px 0;
    transition: border-color .2s ease;
  }
  .mf-input::placeholder { color: #B4B2AC; }
  .mf-input:focus { border-bottom-color: #0078D4; }
  .mf-input.mf-input-error { border-bottom-color: #D13438; }

  .mf-textarea {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid #D2D0CA;
    outline: none;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    color: #1C1B1F;
    padding: 10px 0;
    transition: border-color .2s ease;
    resize: vertical;
    min-height: 60px;
  }
  .mf-textarea::placeholder { color: #B4B2AC; }
  .mf-textarea:focus { border-bottom-color: #0078D4; }

  /* ─── Option Cards (Radio/Checkbox) ─── */
  .mf-option-card {
    width: 100%;
    background: #FFFFFF;
    border: 1.5px solid #D2D0CA;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all .15s ease;
    user-select: none;
    outline: none;
  }
  .mf-option-card:hover {
    border-color: #0078D4;
    background: #F8FAFD;
  }
  .mf-option-card:focus-visible {
    border-color: #0078D4;
    box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.2);
  }
  .mf-option-card.selected {
    border-color: #0078D4;
    background: #EFF6FC;
    box-shadow: 0 1px 3px rgba(0, 120, 212, 0.08);
  }
  .mf-option-label {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 400;
    color: #1C1B1F;
    flex: 1;
    line-height: 1.4;
    transition: color .15s ease;
  }
  .mf-option-card.selected .mf-option-label {
    font-weight: 500;
    color: #0F172A;
  }

  /* ─── Shadcn-Style Radio Indicator ─── */
  .mf-radio-indicator {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #D2D0CA;
    background-color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all .15s ease;
  }
  .mf-option-card:hover .mf-radio-indicator {
    border-color: #0078D4;
  }
  .mf-option-card.selected .mf-radio-indicator {
    border-color: #0078D4;
    background-color: #FFFFFF;
  }
  .mf-radio-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background-color: #0078D4;
    transform: scale(0);
    transition: transform .15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .mf-option-card.selected .mf-radio-dot {
    transform: scale(1);
  }

  /* ─── Shadcn-Style Checkbox Indicator ─── */
  .mf-checkbox-indicator {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #D2D0CA;
    background-color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all .15s ease;
    color: #FFFFFF;
  }
  .mf-option-card:hover .mf-checkbox-indicator {
    border-color: #0078D4;
  }
  .mf-option-card.selected .mf-checkbox-indicator {
    border-color: #0078D4;
    background-color: #0078D4;
  }

  /* ─── Scale ─── */
  .mf-scale-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .mf-scale-btn {
    width: 48px; height: 48px;
    border-radius: 4px;
    border: 1.5px solid #D2D0CA;
    background: #FFFFFF;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1C1B1F;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s ease;
  }
  .mf-scale-btn:hover { border-color: #0078D4; }
  .mf-scale-btn.active {
    background: #0078D4;
    border-color: #0078D4;
    color: #FFFFFF;
  }

  /* ─── Payment Card ─── */
  .mf-payment-card {
    background: #FAFAFA;
    border: 1.5px solid #D2D0CA;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 16px;
  }
  .mf-payment-amount {
    font-family: 'Sora', sans-serif;
    font-size: 28px;
    font-weight: 700;
    color: #1C1B1F;
  }

  /* ─── Submit Button ─── */
  .mf-submit-btn {
    background: #0078D4;
    color: #FFFFFF;
    border: none;
    border-radius: 4px;
    padding: 12px 32px;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background .15s ease;
    margin-top: 8px;
  }
  .mf-submit-btn:hover:not(:disabled) { background: #106EBE; }
  .mf-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .mf-back-btn {
    background: #FFFFFF;
    color: #0078D4;
    border: 1.5px solid #0078D4;
    border-radius: 4px;
    padding: 11px 28px;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all .15s ease;
    margin-top: 8px;
  }
  .mf-back-btn:hover:not(:disabled) { background: #F0F7FD; }
  .mf-back-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ─── Footer ─── */
  .mf-footer {
    text-align: center;
    padding: 24px 0;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    color: #888;
  }
  .mf-footer a { color: #888; text-decoration: none; }
  .mf-footer a:hover { color: #1C1B1F; text-decoration: underline; }

  /* ─── Success Screen ─── */
  .mf-success-card {
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 60px 48px;
    text-align: center;
  }
  @media (max-width: 640px) {
    .mf-success-card { padding: 40px 20px; }
  }

  /* ─── Animations ─── */
  @keyframes mfFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .mf-fade-in {
    animation: mfFadeIn .4s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .mf-fade-in { animation: none !important; opacity: 1 !important; transform: none !important; }
  }

  /* ─── Validation Error ─── */
  .mf-error-msg {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    color: #D13438;
    margin-top: 4px;
  }

  /* ─── Light Mode Calendar & Dropdown Overrides ─── */
  .mf-light-popover,
  [data-slot="popover-content"].mf-light-popover,
  .mf-light-select,
  [data-slot="select-content"].mf-light-select {
    background-color: #FFFFFF !important;
    background: #FFFFFF !important;
    color: #1C1B1F !important;
    border: 1px solid #D2D0CA !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
  }

  .mf-light-select [data-slot="select-item"] {
    color: #1C1B1F !important;
  }
  .mf-light-select [data-slot="select-item"]:hover,
  .mf-light-select [data-slot="select-item"]:focus,
  .mf-light-select [data-slot="select-item"][data-highlighted] {
    background-color: #F3F2F1 !important;
    color: #1C1B1F !important;
  }

  .mf-light-calendar,
  .mf-light-calendar * {
    color: #1C1B1F !important;
  }
  .mf-light-calendar [data-slot="calendar"] {
    background-color: #FFFFFF !important;
    background: #FFFFFF !important;
  }
  .mf-light-calendar .rdp-month_caption {
    color: #1C1B1F !important;
    font-weight: 600 !important;
  }
  .mf-light-calendar .rdp-weekday {
    color: #605E5C !important;
  }
  .mf-light-calendar [data-slot="button"] {
    color: #1C1B1F !important;
  }
  .mf-light-calendar [data-slot="button"]:hover {
    background-color: #F3F2F1 !important;
  }
  .mf-light-calendar [data-selected-single="true"] {
    background-color: #0078D4 !important;
    color: #FFFFFF !important;
    font-weight: 600 !important;
  }
  .mf-light-calendar [data-slot="button"][data-selected-single="true"] {
    background-color: #0078D4 !important;
    color: #FFFFFF !important;
  }
  .mf-light-calendar .rdp-dropdowns,
  .mf-light-calendar [class*="dropdowns"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
  }
  .mf-light-calendar .rdp-dropdown_root,
  .mf-light-calendar [class*="dropdown_root"] {
    position: relative !important;
    display: inline-flex !important;
    align-items: center !important;
    border: 1px solid #D2D0CA !important;
    border-radius: 6px !important;
    background-color: #FFFFFF !important;
    padding: 2px 6px !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
  }
  .mf-light-calendar .rdp-dropdown_root:hover,
  .mf-light-calendar [class*="dropdown_root"]:hover {
    background-color: #F3F2F1 !important;
    border-color: #0078D4 !important;
  }
  .mf-light-calendar select,
  .mf-light-calendar .rdp-dropdown,
  .mf-light-calendar [class*="dropdown"] {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    opacity: 0 !important;
    cursor: pointer !important;
    background-color: #FFFFFF !important;
    color: #1C1B1F !important;
    font-size: 13px !important;
    z-index: 10 !important;
  }
  .mf-light-calendar select option {
    background-color: #FFFFFF !important;
    color: #1C1B1F !important;
    padding: 4px 8px !important;
  }
  .mf-light-calendar .rdp-caption_label,
  .mf-light-calendar [class*="caption_label"] {
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #1C1B1F !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 2px !important;
  }
  .mf-light-calendar .rdp-nav,
  .mf-light-calendar [class*="nav"] {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    position: absolute !important;
    top: 0px !important;
    left: 0px !important;
    right: 0px !important;
    padding: 0 4px !important;
    height: 32px !important;
    pointer-events: none !important;
    z-index: 10 !important;
  }
  .mf-light-calendar .rdp-button_previous,
  .mf-light-calendar .rdp-button_next,
  .mf-light-calendar [class*="button_previous"],
  .mf-light-calendar [class*="button_next"] {
    pointer-events: auto !important;
    background-color: #FFFFFF !important;
    border: 1px solid #D2D0CA !important;
    border-radius: 6px !important;
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: #1C1B1F !important;
    cursor: pointer !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
    transition: all 0.15s ease !important;
    z-index: 20 !important;
  }
  .mf-light-calendar .rdp-button_previous:hover,
  .mf-light-calendar .rdp-button_next:hover,
  .mf-light-calendar [class*="button_previous"]:hover,
  .mf-light-calendar [class*="button_next"]:hover {
    background-color: #F3F2F1 !important;
    border-color: #0078D4 !important;
  }

  /* ─── Closed State ─── */
  .mf-closed-card {
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 60px 48px;
    text-align: center;
  }
  @media (max-width: 640px) {
    .mf-closed-card { padding: 40px 20px; }
  }

  /* ─── Rich Text Content ─── */
  .mf-rich-text {
    font-family: 'Inter', sans-serif;
    line-height: 1.6;
    color: #444;
  }
  .mf-rich-text p { margin: 0 0 8px; }
  .mf-rich-text p:last-child { margin-bottom: 0; }
  .mf-rich-text strong { font-weight: 700; color: #1C1B1F; }
  .mf-rich-text em { font-style: italic; }
  .mf-rich-text ul, .mf-rich-text .my-bullet-list, .mf-rich-text .prose-bullet-list, .tiptap-content ul {
    list-style-type: disc !important;
    margin: 8px 0 !important;
    padding-left: 24px !important;
  }
  .mf-rich-text ol, .mf-rich-text .my-ordered-list, .mf-rich-text .prose-ordered-list, .tiptap-content ol {
    list-style-type: decimal !important;
    margin: 8px 0 !important;
    padding-left: 24px !important;
  }
  .mf-rich-text li, .mf-rich-text .my-list-item, .tiptap-content li {
    display: list-item !important;
    margin: 4px 0 !important;
  }
  .mf-rich-text li p, .tiptap-content li p {
    margin: 0 !important;
    display: inline !important;
  }
`;

/* ─── Helpers ─── */
function getBannerGradient(form: PublishedFormResponse): string {
  const templateId = form.definition.bannerTemplate;
  if (!templateId || templateId === "none") {
    return "linear-gradient(135deg, #2dd4bf 0%, #a7f3d0 50%, #bfdbfe 100%)";
  }
  const tpl = BANNER_TEMPLATES.find((t) => t.id === templateId);
  return tpl
    ? tpl.cssGradient
    : "linear-gradient(135deg, #2dd4bf 0%, #a7f3d0 50%, #bfdbfe 100%)";
}

const tiptapExtensions = [
  StarterKit.configure({
    bulletList: false,
    orderedList: false,
    listItem: false,
  }),
  ListItem.configure({
    HTMLAttributes: {
      class: "my-list-item",
    },
  }),
  BulletList.configure({
    HTMLAttributes: {
      class: "my-bullet-list",
    },
    itemTypeName: "listItem",
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: "my-ordered-list",
    },
    itemTypeName: "listItem",
  }),
  TextAlign.configure({
    types: ["heading", "paragraph", "listItem"],
  }),
];




function autoFormatDescriptionText(text: string): string {
  if (!text) return "";

  if (text.includes("📌") || /important:/i.test(text)) {
    const parts = text.split(/(📌\s*Important:?|Important:)/i);
    if (parts.length >= 3) {
      const intro = parts[0].trim();
      const header = parts[1].trim();
      const rest = parts.slice(2).join("").trim();

      const rawSentences = rest
        .split(/(?<=\.)\s+|\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const bulletItems: string[] = [];
      let outro = "";

      for (const sentence of rawSentences) {
        if (/please complete the form/i.test(sentence)) {
          outro = sentence;
        } else {
          const cleanSentence = sentence.replace(/^[•*\-\s]+/, "").trim();
          if (cleanSentence) bulletItems.push(cleanSentence);
        }
      }

      let html = "";
      if (intro) html += `<p>${intro}</p>`;
      if (header)
        html += `<p style="margin-top: 12px; margin-bottom: 6px;"><strong>${header}</strong></p>`;
      if (bulletItems.length > 0) {
        html += `<ul class="my-bullet-list">`;
        for (const item of bulletItems) {
          html += `<li class="my-list-item"><p>${item}</p></li>`;
        }
        html += `</ul>`;
      }
      if (outro)
        html += `<p style="margin-top: 12px;"><strong>${outro}</strong></p>`;

      return html;
    }
  }

  return plainTextToHtml(text);
}

function plainTextToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  let html = "";
  let inBulletList = false;
  let inOrderedList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inBulletList) {
        html += "</ul>";
        inBulletList = false;
      }
      if (inOrderedList) {
        html += "</ol>";
        inOrderedList = false;
      }
      continue;
    }

    const bulletMatch = line.match(/^(?:[•*\-]|&bull;)\s+(.*)/);
    const orderedMatch = line.match(/^\d+[\.\)]\s+(.*)/);

    if (bulletMatch) {
      if (inOrderedList) {
        html += "</ol>";
        inOrderedList = false;
      }
      if (!inBulletList) {
        html += '<ul class="my-bullet-list">';
        inBulletList = true;
      }
      html += `<li class="my-list-item"><p>${bulletMatch[1]}</p></li>`;
    } else if (orderedMatch) {
      if (inBulletList) {
        html += "</ul>";
        inBulletList = false;
      }
      if (!inOrderedList) {
        html += '<ol class="my-ordered-list">';
        inOrderedList = true;
      }
      html += `<li class="my-list-item"><p>${orderedMatch[1]}</p></li>`;
    } else {
      if (inBulletList) {
        html += "</ul>";
        inBulletList = false;
      }
      if (!inOrderedList) {
        html += "</ol>";
        inOrderedList = false;
      }
      html += `<p>${line}</p>`;
    }
  }

  if (inBulletList) html += "</ul>";
  if (inOrderedList) html += "</ol>";

  return html || `<p>${text}</p>`;
}

/** Render Tiptap JSON or plain text as React elements */
function renderRichText(value: string | null | undefined, className?: string) {
  if (!value) return null;
  try {
    const json = JSON.parse(value);
    if (json && typeof json === "object" && (json.type || json.content)) {
      const html = generateHTML(json, tiptapExtensions);
      return (
        <div className={`mf-rich-text ${className || ""}`}>
          {parse(html)}
        </div>
      );
    }
  } catch {
    // Not JSON — convert plain text to HTML with paragraph and list tags
  }
  const fallbackHtml = autoFormatDescriptionText(value);
  return (
    <div className={`mf-rich-text ${className || ""}`}>
      {parse(fallbackHtml)}
    </div>
  );
}

export default function PublicForm({ form }: PublicFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    previousResponseId: string;
    referenceNumber: string;
    message: string;
    submittedAt?: string;
  } | null>(null);
  const [submittedDetails, setSubmittedDetails] = useState<{
    name?: string;
    email?: string;
    responseId?: string;
    referenceNumber?: string;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [answers, setAnswers] = useState<
    Record<string, string | string[] | Record<string, string>>
  >({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionHistory, setSectionHistory] = useState<number[]>([]);

  // ─── Submission Status Check ───
  useEffect(() => {
    // Reset transient states to prevent cross-form state leaks
    setDuplicateInfo(null);
    setSuccess(false);
    setSubmittedDetails(null);
    setSubmitAttempted(false);
    setName("");
    setEmail("");
    setTransactionId("");
    setAnswers({});
    setTouched({});
    setCurrentSectionIdx(0);
    setSectionHistory([]);

    try {
      const formKey = form.formId || form.id;
      // Clean up any legacy drafts
      localStorage.removeItem(`public_form_draft_${formKey}`);

      const submittedKey = `public_form_submitted_${formKey}`;
      const isAlreadySubmitted = localStorage.getItem(submittedKey);

      // If already submitted and multiple submissions not allowed, stay on success screen
      if (isAlreadySubmitted && !form.definition.settings.allowMultipleSubmissions) {
        const savedName =
          localStorage.getItem(`public_form_submitted_name_${formKey}`) || "";
        const savedEmail =
          localStorage.getItem(`public_form_submitted_email_${formKey}`) || "";
        const savedRespId =
          localStorage.getItem(`public_form_submitted_response_id_${formKey}`) || "";
        setSubmittedDetails({
          name: savedName,
          email: savedEmail,
          responseId: savedRespId,
          referenceNumber: savedRespId
            ? `#${savedRespId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
            : "",
        });
        setSuccess(true);
        setIsMounted(true);
        return;
      }
    } catch {
      // ignore storage error
    } finally {
      setIsMounted(true);
    }
  }, [form.formId, form.id, form.definition.settings.allowMultipleSubmissions]);

  const allFields = useMemo(
    () => form.definition.sections.flatMap((s) => s.fields),
    [form],
  );
  const paymentField = useMemo(
    () => allFields.find((f) => f.type === "payment") || null,
    [allFields],
  );

  const firstName = name.split(" ")[0] || "there";

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);
  const [showDevDiagnostics, setShowDevDiagnostics] = useState<boolean>(false);

  const upiConfig: UpiPaymentConfig | null = useMemo(() => {
    if (!paymentField?.upiId) return null;
    return {
      vpa: paymentField.upiId,
      payeeName: paymentField.payeeName || form.title || "Payment",
      amount: paymentField.paymentAmount,
      currency: "INR",
      transactionNote: paymentField.transactionNote || `${form.title} Payment`,
      merchant: paymentField.merchantEnabled
        ? {
            enabled: true,
            mcc: paymentField.merchantMcc,
            merchantId: paymentField.merchantId,
            terminalId: paymentField.merchantTerminalId,
          }
        : undefined,
    };
  }, [paymentField, form.title]);

  const upiLinks = useMemo(() => {
    if (!upiConfig) return null;
    return getUpiAppLinks(upiConfig);
  }, [upiConfig]);

  const upiDiagnostics = useMemo(() => {
    if (!upiConfig || !upiLinks) return null;
    const parsed = parseUpiUri(upiLinks.universalUri);
    const validation = validateUpiUri(upiLinks.universalUri, upiConfig);
    return {
      uri: upiLinks.universalUri,
      parsed,
      validation,
    };
  }, [upiConfig, upiLinks]);

  // Generate QR Code data URL client-side
  useEffect(() => {
    let isMounted = true;
    if (upiConfig) {
      setIsQrLoading(true);
      generateUpiQrDataUrl(upiConfig, { width: 300, margin: 1 })
        .then((dataUrl) => {
          if (isMounted) {
            setQrDataUrl(dataUrl);
            setIsQrLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to generate UPI QR code:", err);
          if (isMounted) {
            setIsQrLoading(false);
          }
        });
    } else {
      setQrDataUrl("");
    }
    return () => {
      isMounted = false;
    };
  }, [upiConfig]);

  /* ─── Answer Helpers ─── */
  const updateAnswer = (
    id: string,
    val: string | string[] | Record<string, string>,
  ) => {
    setAnswers((c) => ({ ...c, [id]: val }));
    setTouched((c) => ({ ...c, [id]: true }));
  };

  const toggleCheckbox = (id: string, opt: string) => {
    const cur = (answers[id] as string[] | undefined) || [];
    updateAnswer(
      id,
      cur.includes(opt) ? cur.filter((v) => v !== opt) : [...cur, opt],
    );
  };

  const copyToClipboard = (text: string, label: string = "UPI ID") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } else {
      toast.info(`${label}: ${text}`);
    }
  };

  const openUpiApp = (schemeUrl: string, appName: string = "UPI") => {
    if (!paymentField?.upiId) return;
    copyToClipboard(paymentField.upiId, "UPI ID");
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      toast.success(`Opening ${appName}...`);
      window.location.href = schemeUrl;
    } else {
      toast.info(
        `UPI ID (${paymentField.upiId}) copied! Scan the QR code or use your UPI app to pay ₹${paymentField.paymentAmount ?? 0}.`,
        { duration: 5000 },
      );
      try {
        window.location.href = schemeUrl;
      } catch {
        // Suppress desktop scheme errors
      }
    }
  };

  const openUpi = () => {
    if (upiLinks) {
      openUpiApp(upiLinks.universalUri, "UPI app");
    }
  };

  /* ─── Validation ─── */
  const isFieldValid = (field: FormFieldDefinition): boolean => {
    if (field.type === "multi_input") {
      if (!field.required) return true;
      const valObj =
        (answers[field.id] as Record<string, string> | undefined) || {};
      const subQuestions = field.subQuestions || [];
      for (const sub of subQuestions) {
        if (sub.required && !valObj[sub.id]?.trim()) return false;
      }
      return true;
    }
    if (!field.required) return true;
    if (field.type === "payment") return Boolean(transactionId.trim());
    if (field.type === "button") return true;
    if (field.type === "file_upload") {
      const files = answers[field.id];
      return Array.isArray(files) && files.length > 0;
    }
    const val = answers[field.id];
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(typeof val === "string" && val.trim());
  };

  const validateAll = (): boolean => {
    let valid = true;
    if (form.definition.settings.collectName && !name.trim()) valid = false;
    if (
      form.definition.settings.collectEmail &&
      (!email.trim() || !email.includes("@"))
    )
      valid = false;
    for (const field of allFields) {
      if (!isFieldValid(field)) valid = false;
    }
    return valid;
  };

  const validateSection = (secIdx: number): boolean => {
    let valid = true;
    if (secIdx === 0) {
      if (form.definition.settings.collectName && !name.trim()) valid = false;
      if (
        form.definition.settings.collectEmail &&
        (!email.trim() || !email.includes("@"))
      ) {
        valid = false;
      }
    }
    const currentFields = form.definition.sections[secIdx]?.fields || [];
    for (const field of currentFields) {
      if (!isFieldValid(field)) {
        valid = false;
        setTouched((prev) => ({ ...prev, [field.id]: true }));
      }
    }
    if (secIdx === 0) {
      if (form.definition.settings.collectName && !name.trim()) {
        setTouched((prev) => ({ ...prev, __name: true }));
      }
      if (form.definition.settings.collectEmail && (!email.trim() || !email.includes("@"))) {
        setTouched((prev) => ({ ...prev, __email: true }));
      }
    }
    return valid;
  };

  const isFieldError = (fieldId: string, required: boolean): boolean => {
    if (!required) return false;
    if (!submitAttempted && !touched[fieldId]) return false;
    const val = answers[fieldId];
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "object" && val !== null) return false; // multi_input handled separately
    return !val || (typeof val === "string" && !val.trim());
  };

  /* ─── Conditional Branching & Section Navigation ─── */
  const handleNextSection = () => {
    setSubmitAttempted(true);
    if (!validateSection(currentSectionIdx)) {
      toast.error("Please fill in all required fields before proceeding.");
      return;
    }

    const currentSec = form.definition.sections[currentSectionIdx];
    if (!currentSec) return;

    let targetAction: string | undefined = undefined;

    // Check if any question in current section has branching logic active
    for (const field of currentSec.fields) {
      if (
        field.goToSectionBasedOnAnswer &&
        (field.type === "radio" || field.type === "dropdown")
      ) {
        const selectedVal = answers[field.id];
        if (typeof selectedVal === "string" && selectedVal) {
          const optIdx = (field.options || []).indexOf(selectedVal);
          if (optIdx !== -1) {
            const nav =
              field.optionNavigation?.[String(optIdx)] ||
              field.optionNavigation?.[selectedVal];
            if (nav && nav !== "next") {
              targetAction = nav;
              break;
            }
          }
        }
      }
    }

    // If no option-level override, check section's default afterSectionAction
    if (!targetAction) {
      targetAction = currentSec.afterSectionAction || "next";
    }

    // Process targetAction
    if (targetAction === "submit") {
      handleSubmit();
      return;
    }

    let targetIdx = -1;
    if (targetAction.startsWith("section_")) {
      const targetSecId = targetAction.replace("section_", "");
      targetIdx = form.definition.sections.findIndex((s) => s.id === targetSecId);
      // Safeguard: If target section is the current section, avoid loop by advancing to next section
      if (targetIdx === currentSectionIdx) {
        targetIdx = currentSectionIdx + 1;
      }
    } else {
      targetIdx = currentSectionIdx + 1;
    }

    if (targetIdx === -1 || targetIdx >= form.definition.sections.length) {
      handleSubmit();
    } else {
      setSectionHistory((prev) => [...prev, currentSectionIdx]);
      setCurrentSectionIdx(targetIdx);
      setSubmitAttempted(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevSection = () => {
    if (sectionHistory.length === 0) return;
    const prevIdx = sectionHistory[sectionHistory.length - 1];
    setSectionHistory((prev) => prev.slice(0, -1));
    setCurrentSectionIdx(prevIdx);
    setSubmitAttempted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ─── Active/Visited Sections Validation for Submission ─── */
  const validateForSubmission = (): boolean => {
    let valid = true;
    if (form.definition.settings.collectName && !name.trim()) valid = false;
    if (
      form.definition.settings.collectEmail &&
      (!email.trim() || !email.includes("@"))
    ) {
      valid = false;
    }

    // Validate fields in visited sections + current section
    const activeSectionIndices = new Set([...sectionHistory, currentSectionIdx]);
    for (const sIdx of activeSectionIndices) {
      const secFields = form.definition.sections[sIdx]?.fields || [];
      for (const field of secFields) {
        if (!isFieldValid(field)) {
          valid = false;
          setTouched((prev) => ({ ...prev, [field.id]: true }));
        }
      }
    }
    if (form.definition.settings.collectName && !name.trim()) {
      setTouched((prev) => ({ ...prev, __name: true }));
    }
    if (form.definition.settings.collectEmail && (!email.trim() || !email.includes("@"))) {
      setTouched((prev) => ({ ...prev, __email: true }));
    }
    return valid;
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!validateForSubmission()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (paymentField && !transactionId.trim()) {
      toast.error("Please enter your Transaction ID");
      return;
    }
    setIsSubmitting(true);
    const result = await submitFormResponse({
      formId: form.formId,
      answers: {
        ...answers,
        name: form.definition.settings.collectName ? name : undefined,
        email: form.definition.settings.collectEmail ? email : undefined,
      },
      transactionId,
    });

    if (result.status === "duplicate" || (result as any).isDuplicate) {
      setDuplicateInfo({
        previousResponseId: (result as any).previousResponseId || (result as any).data?.id || "",
        referenceNumber: (result as any).referenceNumber || (result as any).data?.referenceNumber || "",
        message: result.message || "A submission with this email has already been recorded.",
        submittedAt: (result as any).data?.submittedAt,
      });
      toast.warning(result.message);
    } else if (result.status === "success") {
      const submittedName = name.trim();
      const submittedEmail = email.trim();
      const respId = (result as any).data?.id || "";
      const refNum = respId ? `#${respId.replace(/-/g, "").slice(0, 8).toUpperCase()}` : "";

      setDuplicateInfo(null);
      setSubmittedDetails({
        name: submittedName,
        email: submittedEmail,
        responseId: respId,
        referenceNumber: refNum,
      });
      setSuccess(true);
      try {
        const formKey = form.formId || form.id;
        localStorage.removeItem(`public_form_draft_${formKey}`);
        localStorage.setItem(`public_form_submitted_${formKey}`, "true");
        if (respId)
          localStorage.setItem(`public_form_submitted_response_id_${formKey}`, respId);
        if (submittedName)
          localStorage.setItem(
            `public_form_submitted_name_${formKey}`,
            submittedName,
          );
        if (submittedEmail)
          localStorage.setItem(
            `public_form_submitted_email_${formKey}`,
            submittedEmail,
          );
      } catch {
        // ignore storage error
      }
      setName("");
      setEmail("");
      setTransactionId("");
      setAnswers({});
      setTouched({});
      setCurrentSectionIdx(0);
      setSectionHistory([]);
    } else {
      toast.error(result.message);
    }
    setIsSubmitting(false);
  };

  const bannerGradient = getBannerGradient(form);
  const bannerImage = form.definition.bannerKey
    ? getImageUrl(form.definition.bannerKey)
    : null;
  const hasAnyRequired =
    allFields.some((f) => f.required) ||
    form.definition.settings.collectName ||
    form.definition.settings.collectEmail;

  /* ─── Dynamically determine if current button should be Submit or Next ─── */
  const isCurrentStepSubmit = useMemo(() => {
    // If it's the last section in the form, it's always submit
    if (currentSectionIdx >= form.definition.sections.length - 1) return true;

    const currentSec = form.definition.sections[currentSectionIdx];
    if (!currentSec) return true;

    // Check if any question in the current section with branching active is pointing to 'submit'
    for (const field of currentSec.fields) {
      if (
        field.goToSectionBasedOnAnswer &&
        (field.type === "radio" || field.type === "dropdown")
      ) {
        const selectedVal = answers[field.id];
        if (typeof selectedVal === "string" && selectedVal) {
          const optIdx = (field.options || []).indexOf(selectedVal);
          if (optIdx !== -1) {
            const nav =
              field.optionNavigation?.[String(optIdx)] ||
              field.optionNavigation?.[selectedVal];
            if (nav === "submit") return true;
            if (nav && nav !== "next" && nav.startsWith("section_")) return false;
          }
        }
      }
    }

    // Otherwise check section's default afterSectionAction
    if (currentSec.afterSectionAction === "submit") {
      return true;
    }

    return false;
  }, [currentSectionIdx, form.definition.sections, answers]);

  /* ─── Build numbered questions ─── */
  let questionNum = 0;

  /* ═══ RENDER: LOADING / MOUNTING (Eliminates Flash on Refresh) ═══ */
  if (!isMounted) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
        <div className="mf-page" style={{ background: "#F3F2F1" }}>
          <div
            className="mf-banner"
            style={{
              background: bannerImage ? undefined : bannerGradient,
            }}
          >
            {bannerImage && (
              <Image
                src={bannerImage}
                alt=""
                fill
                style={{ objectFit: "cover" }}
                priority
              />
            )}
          </div>
          <div className="mf-container">
            <div className="mf-card" style={{ textAlign: "center", padding: "60px 24px" }}>
              <Loader2 className="animate-spin h-7 w-7 text-[#0078D4] mx-auto mb-3" />
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#605E5C", fontWeight: 500 }}>
                Loading form…
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ═══ RENDER: DUPLICATE / ALREADY SUBMITTED ═══ */
  if (duplicateInfo) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
        <div className="mf-page" style={{ background: "#F3F2F1" }}>
          <div
            className="mf-banner"
            style={{
              background: bannerImage ? undefined : bannerGradient,
            }}
          >
            {bannerImage && (
              <Image
                src={bannerImage}
                alt=""
                fill
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div className="mf-container">
            <div className="mf-success-card mf-fade-in" style={{ borderColor: "#E0A800" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#FFF8E1",
                  border: "2px solid #F59E0B",
                  color: "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Ban style={{ width: 28, height: 28, strokeWidth: 2.5 }} />
              </div>

              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#D97706",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Already Submitted
              </p>

              <h1
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: "clamp(22px, 3.5vw, 30px)",
                  fontWeight: 700,
                  color: "#1C1B1F",
                  marginBottom: 12,
                }}
              >
                Response Already Recorded
              </h1>

              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: "#555",
                  lineHeight: 1.6,
                  maxWidth: 480,
                  margin: "0 auto 24px",
                }}
              >
                {duplicateInfo.message}
              </p>

              {/* Previous Response Details Box */}
              <div
                style={{
                  padding: "16px 0",
                  maxWidth: 440,
                  margin: "0 auto 28px",
                  textAlign: "left",
                  borderTop: "1px solid #E5E5E5",
                  borderBottom: "1px solid #E5E5E5",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>Form</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1C1B1F" }}>{form.title}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: duplicateInfo.submittedAt ? 8 : 0 }}>
                  <span style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>Previous Response ID</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#1C1B1F" }}>
                    {duplicateInfo.referenceNumber || `#${duplicateInfo.previousResponseId.slice(0, 8).toUpperCase()}`}
                  </span>
                </div>
                {duplicateInfo.submittedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>Submitted On</span>
                    <span style={{ fontSize: 13, color: "#444" }}>
                      {new Date(duplicateInfo.submittedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 32 }}>
                <button
                  type="button"
                  onClick={() => setDuplicateInfo(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 24px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "'Inter', sans-serif",
                    color: "#1C1B1F",
                    background: "#F3F2F1",
                    border: "1px solid #D2D0CA",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#E5E5E5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F3F2F1";
                  }}
                >
                  Edit &amp; Try Again
                </button>
              </div>

              <div
                style={{
                  marginTop: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    src="/assets/logo.png"
                    alt="Codebreakers"
                    width={36}
                    height={36}
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#1C1B1F",
                  }}
                >
                  CodeBreakers
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ═══ RENDER: SUCCESS ═══ */
  if (success) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
        <div className="mf-page" style={{ background: "#F3F2F1" }}>
          <div
            className="mf-banner"
            style={{
              background: bannerImage ? undefined : bannerGradient,
            }}
          >
            {bannerImage && (
              <Image
                src={bannerImage}
                alt=""
                fill
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div className="mf-container">
            <div className="mf-success-card mf-fade-in">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#107C10",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Check style={{ width: 28, height: 28, strokeWidth: 3 }} />
              </div>

              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#107C10",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Submission Complete
              </p>

              <h1
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: "clamp(24px, 4vw, 34px)",
                  fontWeight: 700,
                  color: "#1C1B1F",
                  marginBottom: 12,
                }}
              >
                You&apos;re in, {submittedDetails?.name ? submittedDetails.name.split(" ")[0] : firstName}!
              </h1>

              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 15,
                  color: "#666",
                  lineHeight: 1.6,
                  maxWidth: 440,
                  margin: "0 auto 32px",
                }}
              >
                {form.definition.settings.successMessage ||
                  `Confirmation sent to ${submittedDetails?.email || email || "your email"}. See you at CodeBreakers.`}
              </p>

              {/* Response Details Box */}
              {submittedDetails?.referenceNumber && (
                <div
                  style={{
                    padding: "12px 16px",
                    maxWidth: 380,
                    margin: "0 auto 28px",
                    background: "#F8F9FA",
                    borderRadius: 8,
                    border: "1px solid #E9ECEF",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#666", fontWeight: 500, display: "block", marginBottom: 4 }}>
                    Response Reference ID
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "#107C10", letterSpacing: "0.05em" }}>
                    {submittedDetails.referenceNumber}
                  </span>
                </div>
              )}

              {form.definition.settings.allowMultipleSubmissions && (
                <div style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="mf-back-btn"
                    onClick={() => {
                      try {
                        localStorage.removeItem(`public_form_submitted_${form.formId}`);
                        localStorage.removeItem(`public_form_submitted_response_id_${form.formId}`);
                        localStorage.removeItem(`public_form_submitted_name_${form.formId}`);
                        localStorage.removeItem(`public_form_submitted_email_${form.formId}`);
                        localStorage.removeItem(`public_form_draft_${form.formId}`);
                      } catch {
                        // ignore storage error
                      }
                      setSuccess(false);
                      setDuplicateInfo(null);
                      setSubmittedDetails(null);
                    }}
                  >
                    Submit another response
                  </button>
                </div>
              )}

              <div
                style={{
                  marginTop: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    src="/assets/logo.png"
                    alt="Codebreakers"
                    width={36}
                    height={36}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: 25,
                    fontWeight: 600,
                    color: "#1C1B1F",
                  }}
                >
                  CodeBreakers
                </span>
              </div>
            </div>
          </div>

          <div className="mf-footer">
            <a href="https://codebreakersgcek.tech/privacy">Privacy Policy</a>
            <span style={{ margin: "0 8px", color: "#ccc" }}>·</span>
            Powered by <strong>CodeBreakers</strong>
          </div>
        </div>
      </>
    );
  }

  /* ═══ RENDER: FORM ═══ */
  const renderField = (field: FormFieldDefinition, qNumber: number) => {
    const fieldError = isFieldError(field.id, field.required);

    if (field.type === "button") {
      return (
        <div className="mf-question mf-fade-in" key={field.id}>
          <p className="mf-question-label">
            {qNumber}. {field.label}
          </p>
          {field.description &&
            renderRichText(field.description, "mf-question-desc")}
          <button
            type="button"
            className="mf-submit-btn"
            style={{ background: "#1F4D3D" }}
            onClick={() => {
              if (!field.buttonUrl) return;
              field.buttonOpenInNewTab
                ? window.open(field.buttonUrl, "_blank", "noopener,noreferrer")
                : (window.location.href = field.buttonUrl);
            }}
          >
            {field.buttonLabel || "Open link"}{" "}
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      );
    }

    if (field.type === "payment") {
      const payErr = submitAttempted && !transactionId.trim();
      return (
        <div className="mf-question mf-fade-in" key={field.id}>
          <p className="mf-question-label">
            {qNumber}. {field.label}
            <span className="mf-asterisk">*</span>
          </p>
          {field.description &&
            renderRichText(field.description, "mf-question-desc")}

          <div className="mf-payment-card" style={{ background: "#FAFAFA", borderRadius: 12, border: "1.5px solid #E2E8F0", padding: 24, marginBottom: 20 }}>
            {/* Amount and Payee Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                borderBottom: "1px solid #E2E8F0",
                paddingBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  Amount Due
                </span>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  Payee: <strong style={{ color: "#0F172A" }}>{field.payeeName || form.title}</strong>
                </span>
              </div>
              <span className="mf-payment-amount" style={{ fontSize: 30, fontWeight: 800, color: "#0F172A" }}>
                ₹{field.paymentAmount ?? 0}
              </span>
            </div>

            {field.upiId && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                {/* QR Code Container */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    border: "1px solid #CBD5E1",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    maxWidth: 260,
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#FFFFFF",
                    }}
                  >
                    {isQrLoading || !qrDataUrl ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#0078D4" }} />
                        <span style={{ fontSize: 12, color: "#64748B" }}>Generating QR...</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Standard UPI Payment QR Code"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          imageRendering: "pixelated",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#64748B",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Scan with any UPI app</span>
                  </div>
                </div>

                {/* UPI ID Pill & Copy Button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    padding: "6px 12px",
                    maxWidth: "100%",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>UPI ID:</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color: "#0F172A",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {field.upiId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(field.upiId!, "UPI ID")}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: "#0078D4",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                    title="Copy UPI ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                {/* Mobile App Intent Pay Buttons */}
                <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    onClick={openUpi}
                    style={{
                      background: "#0078D4",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 2px 4px rgba(0,120,212,0.2)",
                      transition: "background .15s ease",
                    }}
                  >
                    <Smartphone className="h-4 w-4" /> Pay with UPI App
                  </button>

                  {upiLinks && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 2 }}>
                      {upiLinks.apps
                        .filter((app) => app.id !== "generic")
                        .map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => openUpiApp(app.schemeUrl, app.name)}
                            style={{
                              background: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              borderRadius: 6,
                              padding: "6px 4px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#334155",
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "all .15s ease",
                            }}
                            title={`Open ${app.name}`}
                          >
                            {app.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Payment Verification Advisory Notice */}
                <div
                  style={{
                    width: "100%",
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 12,
                    color: "#1E40AF",
                    lineHeight: "1.4",
                  }}
                >
                  <Info className="h-4 w-4 shrink-0" style={{ marginTop: 2, color: "#2563EB" }} />
                  <div>
                    <strong>Verification Notice:</strong> Scanning or opening the app transfers funds directly through your bank.
                    After completing payment, please enter the <strong>UTR / Bank Transaction Reference ID</strong> below to confirm your submission.
                  </div>
                </div>

              </div>
            )}
          </div>

          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: 4,
            }}
          >
            {field.transactionIdLabel || "Transaction ID"}{" "}
            <span style={{ color: "#D13438" }}>*</span>
          </label>
          <input
            className={`mf-input${payErr ? " mf-input-error" : ""}`}
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Paste transaction ID..."
          />
          {payErr && <p className="mf-error-msg">This field is required</p>}
        </div>
      );
    }

    return (
      <div className="mf-question mf-fade-in" key={field.id}>
        <p className="mf-question-label">
          {qNumber}. {field.label}
          {field.required && <span className="mf-asterisk">*</span>}
        </p>
        {field.description &&
          renderRichText(field.description, "mf-question-desc")}

        {field.imageKey && (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: 8,
              overflow: "hidden",
              marginBottom: 16,
              border: "1px solid #e8e8e8",
            }}
          >
            <Image
              src={getImageUrl(field.imageKey)}
              alt=""
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        {/* Short Text / Email / Number */}
        {(field.type === "short_text" ||
          field.type === "email" ||
          field.type === "number") && (
          <div>
            <input
              className={`mf-input${fieldError ? " mf-input-error" : ""}`}
              type={
                field.type === "email"
                  ? "email"
                  : field.type === "number"
                    ? "number"
                    : "text"
              }
              value={(answers[field.id] as string) || ""}
              onChange={(e) => updateAnswer(field.id, e.target.value)}
              placeholder={field.placeholder || "Enter your answer"}
            />
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Long Text */}
        {field.type === "long_text" && (
          <div>
            <textarea
              className={`mf-textarea${fieldError ? " mf-input-error" : ""}`}
              rows={3}
              value={(answers[field.id] as string) || ""}
              onChange={(e) => updateAnswer(field.id, e.target.value)}
              placeholder={field.placeholder || "Enter your answer"}
            />
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Multi Input */}
        {field.type === "multi_input" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {(field.subQuestions || []).map((sub, idx) => {
              const currentValObj =
                (answers[field.id] as Record<string, string> | undefined) || {};
              const subVal = currentValObj[sub.id] || "";
              const isSubRequired = Boolean(field.required && sub.required);
              const subErr =
                (submitAttempted || touched[field.id]) &&
                isSubRequired &&
                !subVal.trim();
              return (
                <div key={sub.id || idx}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1C1B1F",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {sub.label || `Sub-question ${idx + 1}`}
                    {isSubRequired && (
                      <span style={{ color: "#D13438", marginLeft: 2 }}>*</span>
                    )}
                  </label>
                  <input
                    className={`mf-input${subErr ? " mf-input-error" : ""}`}
                    type="text"
                    value={subVal}
                    onChange={(e) => {
                      const updated = {
                        ...currentValObj,
                        [sub.id]: e.target.value,
                      };
                      updateAnswer(field.id, updated);
                    }}
                    placeholder={sub.placeholder || "Enter your answer"}
                  />
                  {subErr && (
                    <p className="mf-error-msg">This field is required</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Linear Scale */}
        {field.type === "linear_scale" && (
          <div>
            <div className="mf-scale-grid">
              {Array.from(
                { length: (field.scaleMax ?? 5) - (field.scaleMin ?? 1) + 1 },
                (_, idx) => (field.scaleMin ?? 1) + idx,
              ).map((num) => {
                const selected = answers[field.id] === String(num);
                return (
                  <button
                    key={num}
                    type="button"
                    className={`mf-scale-btn ${selected ? "active" : ""}`}
                    onClick={() => updateAnswer(field.id, String(num))}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            {(field.scaleMinLabel || field.scaleMaxLabel) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#888",
                  marginTop: 6,
                }}
              >
                <span>{field.scaleMinLabel || ""}</span>
                <span>{field.scaleMaxLabel || ""}</span>
              </div>
            )}
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Radio */}
        {field.type === "radio" && (
          <div role="radiogroup" aria-label={field.label}>
            {(field.options || ["Option 1"]).map((opt) => {
              const selected = answers[field.id] === opt;
              return (
                <div
                  key={opt}
                  className={`mf-option-card ${selected ? "selected" : ""}`}
                  onClick={() => updateAnswer(field.id, opt)}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      updateAnswer(field.id, opt);
                    }
                  }}
                >
                  <div className="mf-radio-indicator">
                    <div className="mf-radio-dot" />
                  </div>
                  <span className="mf-option-label">{opt}</span>
                </div>
              );
            })}
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Checkbox */}
        {field.type === "checkbox" && (
          <div role="group" aria-label={field.label}>
            {(field.options || ["Option 1"]).map((opt) => {
              const cur = (answers[field.id] as string[]) || [];
              const selected = cur.includes(opt);
              return (
                <div
                  key={opt}
                  className={`mf-option-card ${selected ? "selected" : ""}`}
                  onClick={() => toggleCheckbox(field.id, opt)}
                  role="checkbox"
                  aria-checked={selected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleCheckbox(field.id, opt);
                    }
                  }}
                >
                  <div className="mf-checkbox-indicator">
                    {selected && (
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span className="mf-option-label">{opt}</span>
                </div>
              );
            })}
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Dropdown */}
        {field.type === "dropdown" && (
          <div>
            <Select
              value={(answers[field.id] as string) || ""}
              onValueChange={(val) => updateAnswer(field.id, val)}
            >
              <SelectTrigger
                className={`w-auto min-w-[220px] h-11 !bg-white border-[1.5px] ${fieldError ? "!border-[#D13438]" : "!border-[#D2D0CA]"} rounded text-sm !text-[#1C1B1F] focus:!border-[#0078D4] focus:!ring-0 shadow-none`}
              >
                <SelectValue placeholder="Choose an option..." />
              </SelectTrigger>
              <SelectContent className="mf-light-select rounded-lg border border-[#D2D0CA] !bg-white !text-[#1C1B1F] shadow-xl z-50 p-1">
                {(field.options || []).map((opt) => (
                  <SelectItem
                    key={opt}
                    value={opt}
                    className="text-sm py-2 px-3 cursor-pointer !text-[#1C1B1F] hover:!bg-[#F3F2F1] focus:!bg-[#F3F2F1] focus:!text-[#1C1B1F] rounded-md transition-colors"
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* Date */}
        {field.type === "date" && (
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`mf-input text-left flex items-center justify-between cursor-pointer${fieldError ? " mf-input-error" : ""}`}
                  style={{ maxWidth: 260 }}
                >
                  <span
                    style={{ color: answers[field.id] ? "#1C1B1F" : "#B4B2AC" }}
                  >
                    {answers[field.id]
                      ? format(new Date(answers[field.id] as string), "PPP")
                      : "Pick a date..."}
                  </span>
                  <CalendarIcon className="h-4 w-4" style={{ color: "#888" }} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="mf-light-popover w-auto p-0 rounded-xl shadow-xl !bg-white !text-[#1C1B1F] border border-[#D2D0CA] z-50 overflow-hidden"
                align="start"
              >
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  startMonth={new Date(1920, 0)}
                  endMonth={new Date(new Date().getFullYear() + 20, 11)}
                  defaultMonth={
                    answers[field.id]
                      ? new Date(answers[field.id] as string)
                      : new Date()
                  }
                  selected={
                    answers[field.id]
                      ? new Date(answers[field.id] as string)
                      : undefined
                  }
                  onSelect={(day) => {
                    if (day)
                      updateAnswer(field.id, day.toISOString().split("T")[0]);
                  }}
                  className="mf-light-calendar !bg-white !text-[#1C1B1F] p-3"
                  classNames={{
                    months: "flex flex-col sm:flex-row gap-2 relative",
                    month_caption: "flex items-center justify-center h-8 w-full text-sm font-semibold !text-[#1C1B1F] px-10 mb-1",
                    dropdowns: "flex items-center justify-center gap-1.5",
                    dropdown_root: "relative inline-flex items-center border border-[#D2D0CA] rounded-md bg-white px-2 py-1 cursor-pointer hover:border-[#0078D4] hover:bg-[#F3F2F1]",
                    dropdown: "absolute inset-0 opacity-0 cursor-pointer w-full h-full bg-white text-[#1C1B1F] z-10",
                    caption_label: "text-xs font-semibold !text-[#1C1B1F] flex items-center gap-1",
                    nav: "flex items-center justify-between w-full absolute top-0 inset-x-0 px-1 h-8 pointer-events-none z-10",
                    button_previous: "!bg-white hover:!bg-[#F3F2F1] !text-[#1C1B1F] border border-[#D2D0CA] rounded-lg h-7 w-7 p-0 flex items-center justify-center shrink-0 pointer-events-auto shadow-xs transition-colors",
                    button_next: "!bg-white hover:!bg-[#F3F2F1] !text-[#1C1B1F] border border-[#D2D0CA] rounded-lg h-7 w-7 p-0 flex items-center justify-center shrink-0 pointer-events-auto shadow-xs transition-colors",
                    weekdays: "flex border-b border-[#F3F2F1] pb-1",
                    weekday: "!text-[#605E5C] text-xs font-medium w-9 text-center",
                    day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    today: "!bg-[#F3F2F1] !text-[#0078D4] font-bold rounded-lg",
                    outside: "!text-[#A19F9D] opacity-40",
                    disabled: "!text-[#C8C6C4] opacity-30",
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {fieldError && (
              <p className="mf-error-msg">This field is required</p>
            )}
          </div>
        )}

        {/* File Upload */}
        {field.type === "file_upload" && (
          <div>
            <FormFileUploader
              fieldId={field.id}
              label={field.label}
              description={field.description}
              required={field.required}
              allowedFileTypes={field.allowedFileTypes}
              maxFiles={field.maxFiles}
              imageOnly={field.imageOnly}
              multipleFiles={field.multipleFiles}
              value={(answers[field.id] as unknown as ProcessedFormFile[]) || []}
              onChange={(files) => updateAnswer(field.id, files as any)}
              disabled={isSubmitting}
            />
            {fieldError && (
              <p className="mf-error-msg" style={{ marginTop: 6 }}>
                This field is required
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />

      <div className="mf-page" style={{ background: "#F3F2F1" }}>
        {/* ─── Gradient Banner ─── */}
        <div
          className="mf-banner"
          style={{
            background: bannerImage ? undefined : bannerGradient,
          }}
        >
          {bannerImage && (
            <Image
              src={bannerImage}
              alt=""
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          )}
        </div>

        {/* ─── Form Card ─── */}
        <div className="mf-container">
          <div className="mf-card mf-fade-in">
            {/* Form Brand Header */}
            <div className="mf-brand-header">
              <div className="mf-brand-logo-wrap">
                <Image
                  src="/assets/logo.png"
                  alt="Codebreakers"
                  width={20}
                  height={20}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <span className="mf-brand-name">CodeBreakers</span>
            </div>

            {/* Form Title */}
            {form.title && <h1 className="mf-title">{form.title}</h1>}

            {/* Form Description */}
            {form.description &&
              renderRichText(form.description, "mf-description")}

            {!form.acceptingResponses ? (
              /* ─── Closed State ─── */
              <div style={{ paddingTop: 24, textAlign: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#FDE8E8",
                    color: "#D13438",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <Ban style={{ width: 28, height: 28 }} />
                </div>
                <h2
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: "clamp(18px, 3vw, 24px)",
                    fontWeight: 700,
                    color: "#1C1B1F",
                    marginBottom: 8,
                  }}
                >
                  This form is no longer accepting responses
                </h2>
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 14,
                    color: "#666",
                    lineHeight: 1.6,
                    maxWidth: 400,
                    margin: "0 auto",
                  }}
                >
                  The form owner has closed this form for new submissions. If
                  you believe this is a mistake, please contact the form
                  creator.
                </p>
              </div>
            ) : (
              /* ─── Active Form ─── */
              <>
                {/* Disclaimer text */}
                <p className="mf-disclaimer">
                  When you submit this form, it will not automatically collect
                  your details like name and email address unless you provide it
                  yourself.
                </p>

                {/* Required notice */}
                {hasAnyRequired && (
                  <p className="mf-required-notice">
                    <span className="mf-asterisk">*</span> Required
                  </p>
                )}

                {/* ─── Name & Email (Section 1) ─── */}
                {currentSectionIdx === 0 && (
                  <>
                    {/* Name Field */}
                    {form.definition.settings.collectName &&
                      (() => {
                        questionNum++;
                        const nameErr =
                          (submitAttempted || touched["__name"]) && !name.trim();
                        return (
                          <div className="mf-question mf-fade-in">
                            <p className="mf-question-label">
                              {questionNum}. NAME{" "}
                              <span className="mf-asterisk">*</span>
                            </p>
                            <input
                              className={`mf-input${nameErr ? " mf-input-error" : ""}`}
                              type="text"
                              value={name}
                              onChange={(e) => {
                                setName(e.target.value);
                                setTouched((c) => ({ ...c, __name: true }));
                              }}
                              placeholder="Enter your answer"
                            />
                            {nameErr && (
                              <p className="mf-error-msg">This field is required</p>
                            )}
                          </div>
                        );
                      })()}

                    {/* Email Field */}
                    {form.definition.settings.collectEmail &&
                      (() => {
                        questionNum++;
                        const emailErr =
                          (submitAttempted || touched["__email"]) &&
                          (!email.trim() || !email.includes("@"));
                        return (
                          <div className="mf-question mf-fade-in">
                            <p className="mf-question-label">
                              {questionNum}. Email{" "}
                              <span className="mf-asterisk">*</span>
                            </p>
                            <input
                              className={`mf-input${emailErr ? " mf-input-error" : ""}`}
                              type="email"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setTouched((c) => ({ ...c, __email: true }));
                              }}
                              placeholder="Enter your answer"
                            />
                            {emailErr && (
                              <p className="mf-error-msg">
                                Please enter a valid email address
                              </p>
                            )}
                          </div>
                        );
                      })()}
                  </>
                )}

                {/* ─── Current Section Questions ─── */}
                {(() => {
                  const currentSection =
                    form.definition.sections[currentSectionIdx] ||
                    form.definition.sections[0];
                  if (!currentSection) return null;

                  return (
                    <div key={currentSection.id} className="mf-fade-in">
                      {form.definition.sections.length > 1 && (
                        <div
                          style={{
                            marginTop: 20,
                            marginBottom: 16,
                            paddingBottom: 10,
                            borderBottom: "1.5px solid #EDEBE9",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#0078D4",
                                background: "#EFF6FC",
                                padding: "3px 8px",
                                borderRadius: 4,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Section {currentSectionIdx + 1} of{" "}
                              {form.definition.sections.length}
                            </span>
                          </div>
                          {currentSection.title &&
                            currentSection.title !== "Section 1" && (
                              <h2
                                style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  margin: "6px 0 4px",
                                  color: "#1C1B1F",
                                }}
                              >
                                {currentSection.title}
                              </h2>
                            )}
                          {currentSection.description &&
                            renderRichText(
                              currentSection.description,
                              "mf-description",
                            )}
                        </div>
                      )}
                      {currentSection.fields.map((field) => {
                        questionNum++;
                        return renderField(field, questionNum);
                      })}
                    </div>
                  );
                })()}

                {/* ─── Navigation Buttons (Back / Next / Submit) ─── */}
                <div
                  style={{
                    paddingTop: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  {sectionHistory.length > 0 ? (
                    <button
                      type="button"
                      className="mf-back-btn"
                      disabled={isSubmitting}
                      onClick={handlePrevSection}
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {isCurrentStepSubmit ? (
                    <button
                      type="button"
                      className="mf-submit-btn"
                      disabled={isSubmitting}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4" /> Submitting…
                        </>
                      ) : (
                        <>
                          {form.definition.settings.submitButtonLabel || "Submit"}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mf-submit-btn"
                      disabled={isSubmitting}
                      onClick={handleNextSection}
                    >
                      Next
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ─── Footer ─── */}
          <div className="mf-footer">
            <a href="/privacy">Privacy Policy</a>
            <span style={{ margin: "0 8px", color: "#ccc" }}>·</span>
            Powered by <strong>CodeBreakers</strong>
          </div>
        </div>
      </div>
    </>
  );
}
