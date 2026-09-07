/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSensor, useSensors, PointerSensor, DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ThemeSelectorDropdown } from "@/components/ui/theme-selector-dropdown";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Eye,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Star,
  ImageIcon,
  FileText,
  CheckSquare,
  ChevronDown,
  Circle,
  AlignLeft,
  Calendar as CalendarIcon,
  CreditCard,
  Type,
  X,
  ArrowLeft,
  Link2,
  Settings2,
  HelpCircle,
  Globe,
  Lock,
  Palette,
  LayoutTemplate,
  Layers,
  Check,
  SlidersHorizontal,
  HardDrive,
  MoreHorizontal,
  Split,
  ArrowRight,
} from "lucide-react";
import {
  createForm,
  updateForm,
  toggleFormPublish,
  updateFormResponseStatus,
  deleteFormResponse,
  type FormDetail,
  type FormResponseSummary,
} from "../actions";
import {
  createBlankFormDefinition,
  BANNER_TEMPLATES,
  type BannerTemplateId,
  type FormDefinition,
  type FormFieldDefinition,
  type FormFieldType,
  type FormSectionDefinition,
} from "@/lib/form-types";
import { Uploader } from "@/components/file-uploader/Uploader";
import { MiniRichEditor } from "@/components/admin_components/rich-text-editor/MiniRichEditor";
import { generateUpiQrDataUrl, UpiPaymentConfig } from "@/lib/upi";

/* ─── Helpers ─── */

interface FormBuilderProps {
  initialDefinition?: FormDefinition;
  initialForm?: FormDetail | null;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getImageUrl(key?: string | null) {
  if (!key) return "";
  return `https://codebreakers.t3.storage.dev/${key}`;
}

function getFieldDescriptionText(desc: string | null | undefined): string {
  if (!desc) return "";
  try {
    const parsed = JSON.parse(desc);
    if (parsed && typeof parsed === "object" && (parsed.type || parsed.content)) {
      const extractText = (node: any): string => {
        if (!node) return "";
        if (typeof node === "string") return node;
        if (node.text) return node.text;
        if (Array.isArray(node.content)) {
          return node.content.map(extractText).filter(Boolean).join(" ");
        }
        return "";
      };
      return extractText(parsed);
    }
  } catch {
    // Not JSON, plain text
  }
  return desc;
}

function getResponseName(answers: Record<string, unknown> | null | undefined): string {
  if (!answers) return "N/A";
  if (typeof answers.name === "string" && answers.name.trim()) return answers.name;
  for (const [k, v] of Object.entries(answers)) {
    if (k.toLowerCase().includes("name") && typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return "N/A";
}

function getResponseEmail(answers: Record<string, unknown> | null | undefined): string {
  if (!answers) return "N/A";
  if (typeof answers.email === "string" && answers.email.trim()) return answers.email;
  for (const [k, v] of Object.entries(answers)) {
    if (k.toLowerCase().includes("email") && typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return "N/A";
}

function normalizeDefinition(definition: FormDefinition): FormDefinition {
  return {
    ...definition,
    bannerKey: definition.bannerKey ?? "",
    bannerTemplate: definition.bannerTemplate ?? "purple-blue",
    sections: (definition.sections || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section, si) => ({
        ...section,
        order: si,
        fields: (section.fields || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((field, fi) => ({
            ...field,
            order: fi,
            options: field.options ?? ["Option 1"],
            required: Boolean(field.required),
            transactionIdLabel: field.type === "payment" ? (field.transactionIdLabel || "Transaction ID") : field.transactionIdLabel,
            buttonOpenInNewTab: Boolean(field.buttonOpenInNewTab),
            subQuestions: field.subQuestions ?? (field.type === "multi_input" ? [
              { id: createId("sub"), label: "Sub-question 1", placeholder: "Enter answer...", required: false },
              { id: createId("sub"), label: "Sub-question 2", placeholder: "Enter answer...", required: false },
            ] : undefined),
          })),
      })),
    settings: {
      submitButtonLabel: definition.settings?.submitButtonLabel || "Submit",
      successMessage: definition.settings?.successMessage || "Your response has been submitted successfully.",
      allowMultipleSubmissions: Boolean(definition.settings?.allowMultipleSubmissions),
      collectName: definition.settings?.collectName !== false,
      collectEmail: definition.settings?.collectEmail !== false,
    },
  };
}

function emptySection(order: number): FormSectionDefinition {
  return { id: createId("section"), title: `Section ${order + 1}`, description: "", order, fields: [] };
}

function emptyField(type: FormFieldType, order: number): FormFieldDefinition {
  return {
    id: createId("field"),
    type,
    label:
      type === "button"
        ? "Button Link"
        : type === "payment"
        ? "Payment Block"
        : type === "linear_scale"
        ? "Rating Scale"
        : type === "multi_input"
        ? "Multiple Input Questions"
        : type === "file_upload"
        ? "Upload File"
        : "Untitled Question",
    description: "",
    placeholder: "",
    required: false,
    order,
    options: ["Option 1"],
    buttonLabel: "Open link",
    buttonUrl: "https://",
    buttonOpenInNewTab: true,
    qrCodeKey: "",
    upiId: "",
    transactionIdLabel: "Transaction ID",
    imageKey: "",
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: "",
    scaleMaxLabel: "",
    subQuestions: type === "multi_input" ? [
      { id: createId("sub"), label: "Sub-question 1", placeholder: "Enter answer...", required: false },
      { id: createId("sub"), label: "Sub-question 2", placeholder: "Enter answer...", required: false },
    ] : undefined,
    allowedFileTypes: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxFiles: 1,
    imageOnly: false,
    multipleFiles: false,
  };
}

function reorder<T>(items: T[], from: number, to: number) { return arrayMove(items, from, to); }

const FIELD_TYPE_OPTIONS: Array<{ value: FormFieldType; label: string; icon: React.ReactNode }> = [
  { value: "short_text", label: "Short answer", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "long_text", label: "Paragraph", icon: <FileText className="h-4 w-4" /> },
  { value: "multi_input", label: "Multiple Input Boxes", icon: <Layers className="h-4 w-4" /> },
  { value: "radio", label: "Multiple choice", icon: <Circle className="h-4 w-4" /> },
  { value: "checkbox", label: "Checkboxes", icon: <CheckSquare className="h-4 w-4" /> },
  { value: "dropdown", label: "Drop-down", icon: <ChevronDown className="h-4 w-4" /> },
  { value: "linear_scale", label: "Linear scale", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { value: "file_upload", label: "File Upload", icon: <HardDrive className="h-4 w-4" /> },
  { value: "date", label: "Date", icon: <CalendarIcon className="h-4 w-4" /> },
  { value: "email", label: "Email", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "number", label: "Number", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "payment", label: "Payment Block", icon: <CreditCard className="h-4 w-4" /> },
  { value: "button", label: "Button Link", icon: <ExternalLink className="h-4 w-4" /> },
];

/* ─── Payment Field Preview Component ─── */
function PaymentFieldPreview({ field }: { field: FormFieldDefinition }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!field.upiId?.trim()) {
      setQrUrl("");
      return;
    }
    setLoading(true);
    const config: UpiPaymentConfig = {
      vpa: field.upiId.trim(),
      payeeName: field.payeeName?.trim() || field.label?.trim() || "Payment",
      amount: field.paymentAmount,
      currency: "INR",
      transactionNote: field.transactionNote?.trim(),
      merchant: field.merchantEnabled
        ? {
            enabled: true,
            mcc: field.merchantMcc?.trim(),
            merchantId: field.merchantId?.trim(),
            terminalId: field.merchantTerminalId?.trim(),
          }
        : undefined,
    };

    generateUpiQrDataUrl(config, { width: 200, margin: 1 })
      .then((url) => {
        if (isMounted) {
          setQrUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Preview QR generation error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    field.upiId,
    field.payeeName,
    field.label,
    field.paymentAmount,
    field.transactionNote,
    field.merchantEnabled,
    field.merchantMcc,
    field.merchantId,
    field.merchantTerminalId,
  ]);

  if (!field.upiId?.trim()) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Enter a UPI ID and Amount to automatically generate a standard NPCI UPI QR code and Pay Now redirection.
      </p>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-background border border-border flex items-center gap-4">
      <div className="relative w-20 h-20 bg-white rounded-md border border-border p-1 shrink-0 flex items-center justify-center">
        {loading || !qrUrl ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrUrl}
            alt="Live UPI QR"
            className="w-full h-full object-contain"
          />
        )}
      </div>
      <div className="text-xs space-y-1">
        <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold text-[10px]">
          Standard NPCI Dynamic QR
        </span>
        <p className="font-semibold text-foreground">
          Amount: {field.paymentAmount !== undefined ? `₹${field.paymentAmount}` : "Variable"}
        </p>
        <p className="text-muted-foreground truncate max-w-[200px]">
          UPI: {field.upiId}
        </p>
        {field.merchantEnabled && field.merchantMcc && (
          <p className="text-[10px] text-blue-600 font-mono">
            MCC: {field.merchantMcc} (Merchant)
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Banner Selection Right Sidebar Sheet ─── */

function BannerSidebarSheet({
  isOpen,
  onClose,
  bannerKey,
  bannerTemplate,
  onChangeBannerKey,
  onChangeBannerTemplate,
}: {
  isOpen: boolean;
  onClose: () => void;
  bannerKey?: string;
  bannerTemplate?: BannerTemplateId;
  onChangeBannerKey: (k: string) => void;
  onChangeBannerTemplate: (id: BannerTemplateId) => void;
}) {
  const currentTemplate = BANNER_TEMPLATES.find((t) => t.id === (bannerTemplate || "none"));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} modal>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex h-dvh max-h-screen flex-col overflow-hidden"
      >
        {/* Fixed Header */}
        <div className="shrink-0 border-b bg-background px-6 pt-6 pb-4">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" /> Form Header Banner
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Customize the header banner for your form. Choose a pre-defined gradient template or upload a custom hero image.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable Body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6"
          onWheel={(e) => e.stopPropagation()}
          onTouchMoveCapture={(e) => e.stopPropagation()}
        >
          {/* Live Banner Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</Label>
            <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-border shadow-sm">
              {bannerKey ? (
                <Image src={getImageUrl(bannerKey)} alt="Banner Preview" fill className="object-cover" />
              ) : currentTemplate && currentTemplate.id !== "none" ? (
                <div
                  className={`w-full h-full bg-gradient-to-r ${currentTemplate.gradient}`}
                  style={{ background: currentTemplate.cssGradient }}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground italic">
                  No header banner selected
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Preset Gradient Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preset Gradient Templates</Label>
              {bannerTemplate && bannerTemplate !== "none" && !bannerKey && (
                <span className="text-[11px] text-primary font-medium">Active Template</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {BANNER_TEMPLATES.map((tmpl) => {
                const isSelected = bannerTemplate === tmpl.id && !bannerKey;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      onChangeBannerTemplate(tmpl.id as BannerTemplateId);
                      onChangeBannerKey("");
                    }}
                    className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all p-1 flex flex-col justify-end text-left group ${
                      isSelected ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border/50 hover:border-primary/40 hover:scale-[1.01]"
                    }`}
                  >
                    {tmpl.id === "none" ? (
                      <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <div
                        className={`w-full h-full rounded-lg bg-gradient-to-r ${tmpl.gradient}`}
                        style={{ background: tmpl.cssGradient }}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs px-2 py-1 text-[10px] font-medium text-white truncate flex items-center justify-between">
                      <span>{tmpl.label}</span>
                      {isSelected && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Custom Image Upload */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upload Custom Image</Label>
            <Uploader
              fileTypeAccepted="image"
              value={bannerKey || ""}
              onChange={(key) => {
                onChangeBannerKey(key);
                onChangeBannerTemplate("none");
              }}
              maxSize={10 * 1024 * 1024}
            />
          </div>

          {/* Clear Banner Button */}
          {(bannerKey || (bannerTemplate && bannerTemplate !== "none")) && (
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs text-destructive hover:bg-destructive/10 border-destructive/30 rounded-xl"
              onClick={() => {
                onChangeBannerKey("");
                onChangeBannerTemplate("none");
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove Banner
            </Button>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 border-t bg-background px-6 py-4">
          <Button type="button" onClick={onClose} className="w-full rounded-xl">
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Google Forms-Style Adaptive Side Toolbar ─── */

function AdaptiveSideToolbar({
  onAddField,
  onAddSection,
  onOpenBanner,
  isMobileHorizontal = false,
}: {
  onAddField: (type: FormFieldType) => void;
  onAddSection: () => void;
  onOpenBanner: () => void;
  isMobileHorizontal?: boolean;
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const moreTypes: Array<{
    type: FormFieldType;
    icon: React.ElementType;
    label: string;
    description: string;
  }> = [
    { type: "long_text", icon: AlignLeft, label: "Long answer", description: "Multi-line paragraph text" },
    { type: "linear_scale", icon: SlidersHorizontal, label: "Linear scale", description: "Numeric rating scale" },
    { type: "payment", icon: CreditCard, label: "Payment", description: "UPI payment & dynamic QR" },
    { type: "date", icon: CalendarIcon, label: "Date picker", description: "Interactive calendar picker" },
    { type: "multi_input", icon: Layers, label: "Multi-inputs", description: "Sub-question inputs" },
    { type: "button", icon: ExternalLink, label: "Link button", description: "Action button to external URL" },
  ];

  if (isMobileHorizontal) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onAddField("radio")}
          title="Add multiple choice"
          className="h-8 w-8 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/30 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onAddField("short_text")}
          title="Add short answer"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-95 cursor-pointer"
        >
          <Type className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onAddField("checkbox")}
          title="Add checkboxes"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-95 cursor-pointer"
        >
          <CheckSquare className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onAddField("file_upload")}
          title="Add file upload"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-95 cursor-pointer"
        >
          <HardDrive className="h-4 w-4" />
        </button>

        <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="More question types"
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                isMoreOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-60 p-1.5 rounded-2xl shadow-xl z-50 border border-border bg-card">
            <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              More Types
            </p>
            <div className="space-y-0.5">
              {moreTypes.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onAddField(type);
                    setIsMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left hover:bg-muted/80 transition-colors text-xs font-medium cursor-pointer"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border/60 mx-0.5" />
        <button
          type="button"
          onClick={onAddSection}
          title="Add section"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-all active:scale-95 cursor-pointer"
        >
          <Layers className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenBanner}
          title="Banner settings"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-95 cursor-pointer"
        >
          <Palette className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-card border border-border/80 rounded-2xl shadow-xl shadow-black/8 p-1.5 flex flex-col gap-1 w-fit select-none animate-in fade-in-50 zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onAddField("radio")}
        title="Add question (Multiple choice)"
        className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Plus className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onAddField("short_text")}
        title="Add short answer"
        className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Type className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onAddField("checkbox")}
        title="Add checkboxes"
        className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <CheckSquare className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onAddField("file_upload")}
        title="Add file upload (Google Drive)"
        className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <HardDrive className="h-4 w-4" />
      </button>

      {/* Adaptive More Options Popover */}
      <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="More question types"
            className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isMoreOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={10}
          className="w-64 p-1.5 rounded-2xl shadow-2xl z-50 border border-border bg-card"
        >
          <p className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            More Question Types
          </p>
          <div className="space-y-0.5">
            {moreTypes.map(({ type, icon: Icon, label, description }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onAddField(type);
                  setIsMoreOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-muted/80 transition-colors cursor-pointer"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="my-0.5 h-px bg-border/50 mx-1" />

      <button
        type="button"
        onClick={onAddSection}
        title="Add new section"
        className="h-9 w-9 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Layers className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onOpenBanner}
        title="Header Banner Settings"
        className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Palette className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Question Card ─── */

function QuestionCard({
  sectionId,
  field,
  isActive,
  isGoogleDriveConnected,
  sections,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddField,
  onAddSection,
  onOpenBanner,
}: {
  sectionId: string;
  field: FormFieldDefinition;
  isActive: boolean;
  isGoogleDriveConnected?: boolean | null;
  sections: FormSectionDefinition[];
  onSelect: () => void;
  onUpdate: (patch: Partial<FormFieldDefinition>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddField: (type: FormFieldType) => void;
  onAddSection: () => void;
  onOpenBanner: () => void;
}) {
  const [showImageUpload, setShowImageUpload] = useState(false);
  const sortableId = `field:${sectionId}:${field.id}`;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sortableId });

  const addOption = () => { const o = field.options || []; onUpdate({ options: [...o, `Option ${o.length + 1}`] }); };
  const addOtherOption = () => { if (!(field.options || []).includes("Other...")) onUpdate({ options: [...(field.options || []), "Other..."] }); };
  const updateOptionText = (i: number, text: string) => { const o = [...(field.options || [])]; o[i] = text; onUpdate({ options: o }); };
  const removeOption = (i: number) => { const o = (field.options || []).filter((_, idx) => idx !== i); onUpdate({ options: o.length > 0 ? o : ["Option 1"] }); };

  return (
    <div
      id={`field-card-${field.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={`group relative rounded-2xl transition-all duration-300 cursor-pointer
        ${isActive ? "bg-card border-2 border-primary/50 shadow-lg shadow-primary/10 ring-2 ring-primary/10 cursor-default" : "bg-card border border-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 shadow-xs"}`}
    >
      {/* Side Toolbar (anchored to active question card) */}
      {isActive && (
        <div className="hidden md:flex absolute -right-12 sm:-right-14 top-2 z-30">
          <AdaptiveSideToolbar
            onAddField={onAddField}
            onAddSection={onAddSection}
            onOpenBanner={onOpenBanner}
          />
        </div>
      )}

      {isActive && <div className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-full" />}
      <div className="flex justify-center pt-3 pb-1">
        <button type="button" className="text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing transition-colors p-1" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 rotate-90" />
        </button>
      </div>

      <div className="px-6 pb-6">
        {isActive ? (
          <div className="space-y-5">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative bg-muted/30 rounded-xl border border-border/50 focus-within:border-primary focus-within:bg-background transition-all overflow-hidden">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="Question"
                    className="w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground px-4 py-3 pr-12"
                    autoFocus
                  />
                  <button
                    type="button"
                    title="Add image to question"
                    onClick={(e) => { e.stopPropagation(); setShowImageUpload((v) => !v); }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${field.imageKey ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Select value={field.type} onValueChange={(val) => onUpdate({ type: val as FormFieldType })}>
                <SelectTrigger className="w-full sm:w-56 h-12 bg-muted/30 border-border/50 hover:border-primary/50 font-medium rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="cursor-pointer rounded-lg">
                      <div className="flex items-center gap-2"><span className="text-muted-foreground">{opt.icon}</span><span>{opt.label}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image uploader */}
            {showImageUpload && (
              <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Question image</p>
                  {field.imageKey && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-destructive hover:bg-destructive/10" onClick={() => { onUpdate({ imageKey: "" }); setShowImageUpload(false); }}>Remove</Button>}
                </div>
                {field.imageKey && <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/40"><Image src={getImageUrl(field.imageKey)} alt="Question image" fill className="object-cover" /></div>}
                <Uploader fileTypeAccepted="image" value={field.imageKey || ""} onChange={(key) => { onUpdate({ imageKey: key }); setShowImageUpload(false); }} maxSize={10 * 1024 * 1024} />
              </div>
            )}
            {!showImageUpload && field.imageKey && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/40 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowImageUpload(true); }}>
                <Image src={getImageUrl(field.imageKey)} alt="" fill className="object-cover" />
                <div className="absolute inset-0 flex items-end justify-end p-2">
                  <span className="text-[11px] bg-black/60 text-white rounded-lg px-2 py-1 flex items-center gap-1"><Palette className="h-3 w-3" /> Change</span>
                </div>
              </div>
            )}

            {/* Helper text */}
            <MiniRichEditor
              value={field.description || ""}
              onChange={(val) => onUpdate({ description: val })}
              placeholder="Description or helper text (optional)"
            />

            {/* Field editor */}
            <div>
              {field.type === "short_text" || field.type === "email" || field.type === "number" ? (
                <Input disabled placeholder="Short answer text" className="max-w-xs bg-muted/20 border-dashed border-muted-foreground/30 text-muted-foreground rounded-xl h-10" />
              ) : field.type === "long_text" ? (
                <Textarea disabled placeholder="Long answer text" rows={2} className="bg-muted/20 border-dashed border-muted-foreground/30 text-muted-foreground rounded-xl resize-none" />
              ) : field.type === "date" ? (
                <div className="inline-flex items-center gap-2 bg-muted/20 border border-dashed border-muted-foreground/30 rounded-xl px-4 py-2.5 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" /><span>Day / Month / Year</span>
                </div>
              ) : field.type === "radio" || field.type === "checkbox" || field.type === "dropdown" ? (
                <div className="space-y-2.5">
                  {(field.type === "radio" || field.type === "dropdown") && field.goToSectionBasedOnAnswer && sections.length > 1 && (
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                      <Split className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Branching active: Choose what section each option navigates to.</span>
                    </div>
                  )}

                  {(field.options || ["Option 1"]).map((option, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-3 flex-1">
                        {field.type === "radio" ? (
                          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/50 shrink-0" />
                        ) : field.type === "checkbox" ? (
                          <div className="h-4 w-4 rounded border-2 border-muted-foreground/50 shrink-0" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{idx + 1}.</span>
                        )}
                        <Input
                          value={option}
                          onChange={(e) => updateOptionText(idx, e.target.value)}
                          className="flex-1 bg-background border-border/50 hover:border-primary/50 focus-visible:ring-primary/30 text-sm h-9 rounded-lg"
                          placeholder={`Option ${idx + 1}`}
                        />
                        {(field.options?.length || 0) > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(idx)}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Go to section dropdown per option */}
                      {field.goToSectionBasedOnAnswer && (field.type === "radio" || field.type === "dropdown") && sections.length > 1 && (
                        <div className="pl-7 sm:pl-0 shrink-0">
                          <Select
                            value={field.optionNavigation?.[String(idx)] || "next"}
                            onValueChange={(val) => {
                              const nav = { ...(field.optionNavigation || {}) };
                              nav[String(idx)] = val;
                              onUpdate({ optionNavigation: nav });
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-56 h-8 bg-muted/40 border-border/60 text-xs rounded-lg font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="next" className="text-xs">Continue to next section</SelectItem>
                              {sections
                                .filter((sec) => sec.id !== sectionId)
                                .map((sec) => {
                                  const sIdx = sections.findIndex((s) => s.id === sec.id);
                                  return (
                                    <SelectItem key={sec.id} value={`section_${sec.id}`} className="text-xs">
                                      Go to section {sIdx + 1} ({sec.title || `Section ${sIdx + 1}`})
                                    </SelectItem>
                                  );
                                })}
                              <SelectItem value="submit" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                Submit form
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={addOption} className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg h-8 cursor-pointer"><Plus className="mr-1 h-3 w-3" /> Add option</Button>
                    <span className="text-muted-foreground/50 text-xs">or</span>
                    <Button type="button" variant="ghost" size="sm" onClick={addOtherOption} className="text-xs text-muted-foreground hover:text-foreground rounded-lg h-8 cursor-pointer">Add &quot;Other&quot;</Button>
                  </div>
                </div>
              ) : field.type === "button" ? (
                <div className="space-y-4 rounded-xl bg-muted/30 p-4 border border-border/50">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-medium">Button Label</Label><Input value={field.buttonLabel || ""} onChange={(e) => onUpdate({ buttonLabel: e.target.value })} placeholder="e.g. Join Group" className="bg-background rounded-lg" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-medium">Target URL</Label><Input value={field.buttonUrl || ""} onChange={(e) => onUpdate({ buttonUrl: e.target.value })} placeholder="https://..." className="bg-background rounded-lg" /></div>
                  </div>
                  <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Open in new tab</span><Switch checked={Boolean(field.buttonOpenInNewTab)} onCheckedChange={(c) => onUpdate({ buttonOpenInNewTab: c })} /></div>
                </div>
              ) : field.type === "payment" ? (
                <div className="space-y-4 rounded-xl bg-muted/30 p-4 border border-border/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">UPI ID / VPA *</Label>
                      <Input
                        value={field.upiId || ""}
                        onChange={(e) => onUpdate({ upiId: e.target.value })}
                        placeholder="e.g. user@upi or merchant@sbi"
                        className="bg-background rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Payment Amount (₹) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.paymentAmount ?? ""}
                        onChange={(e) => onUpdate({ paymentAmount: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="e.g. 299.00"
                        className="bg-background rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Payee Name (Optional)</Label>
                      <Input
                        value={field.payeeName || ""}
                        onChange={(e) => onUpdate({ payeeName: e.target.value })}
                        placeholder="e.g. Codebreakers GCEK"
                        className="bg-background rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Transaction ID Field Label</Label>
                      <Input
                        value={field.transactionIdLabel || ""}
                        onChange={(e) => onUpdate({ transactionIdLabel: e.target.value })}
                        placeholder="e.g. UTR / Transaction Reference ID"
                        className="bg-background rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Merchant Account Configuration Toggle */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between py-1">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-foreground">Registered Merchant Configuration</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Enable only if this is an official business merchant UPI account with an acquiring bank MCC.
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(field.merchantEnabled)}
                        onCheckedChange={(c) => onUpdate({ merchantEnabled: c })}
                      />
                    </div>

                    {field.merchantEnabled && (
                      <div className="mt-3 p-3 bg-background rounded-lg border border-border/60 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground">Merchant Category Code (MCC)</Label>
                            <Input
                              value={field.merchantMcc || ""}
                              onChange={(e) => onUpdate({ merchantMcc: e.target.value.trim() })}
                              placeholder="e.g. 5411, 8220"
                              maxLength={4}
                              className="text-xs bg-muted/20"
                            />
                            <span className="text-[10px] text-muted-foreground">Official 4-digit MCC</span>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground">Merchant ID (Optional)</Label>
                            <Input
                              value={field.merchantId || ""}
                              onChange={(e) => onUpdate({ merchantId: e.target.value.trim() })}
                              placeholder="e.g. MID12345"
                              className="text-xs bg-muted/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground">Terminal ID (Optional)</Label>
                            <Input
                              value={field.merchantTerminalId || ""}
                              onChange={(e) => onUpdate({ merchantTerminalId: e.target.value.trim() })}
                              placeholder="e.g. TID12345"
                              className="text-xs bg-muted/20"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <PaymentFieldPreview field={field} />
                </div>
              ) : field.type === "linear_scale" ? (
                <div className="space-y-4 rounded-xl bg-muted/30 p-4 border border-border/50">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground font-medium">Min</Label>
                      <Select
                        value={String(field.scaleMin ?? 1)}
                        onValueChange={(v) => onUpdate({ scaleMin: Number(v) })}
                      >
                        <SelectTrigger className="w-20 h-9 bg-background rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="0" className="text-xs">0</SelectItem>
                          <SelectItem value="1" className="text-xs">1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <span className="text-xs text-muted-foreground font-medium">to</span>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground font-medium">Max</Label>
                      <Select
                        value={String(field.scaleMax ?? 5)}
                        onValueChange={(v) => onUpdate({ scaleMax: Number(v) })}
                      >
                        <SelectTrigger className="w-20 h-9 bg-background rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <SelectItem key={num} value={String(num)} className="text-xs">{num}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground font-medium">Label for {field.scaleMin ?? 1} (optional)</Label>
                      <Input
                        value={field.scaleMinLabel || ""}
                        onChange={(e) => onUpdate({ scaleMinLabel: e.target.value })}
                        placeholder="e.g. Just starting out"
                        className="bg-background rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground font-medium">Label for {field.scaleMax ?? 5} (optional)</Label>
                      <Input
                        value={field.scaleMaxLabel || ""}
                        onChange={(e) => onUpdate({ scaleMaxLabel: e.target.value })}
                        placeholder="e.g. Seasoned builder"
                        className="bg-background rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live Rating Scale Preview</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from(
                        { length: (field.scaleMax ?? 5) - (field.scaleMin ?? 1) + 1 },
                        (_, idx) => (field.scaleMin ?? 1) + idx
                      ).map((num, idx) => (
                        <div
                          key={num}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm transition-all ${
                            idx === 0
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background border-border/80 text-foreground"
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                    {(field.scaleMinLabel || field.scaleMaxLabel) && (
                      <div className="flex justify-between text-xs text-muted-foreground mt-2 max-w-xs px-1">
                        <span>{field.scaleMinLabel || ""}</span>
                        <span>{field.scaleMaxLabel || ""}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : field.type === "multi_input" ? (
                <div className="space-y-4 rounded-xl bg-muted/30 p-4 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Sub-Questions / Input Boxes
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const subs = field.subQuestions || [];
                        onUpdate({
                          subQuestions: [
                            ...subs,
                            {
                              id: createId("sub"),
                              label: `Sub-question ${subs.length + 1}`,
                              placeholder: "Enter answer...",
                              required: false,
                            },
                          ],
                        });
                      }}
                      className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg h-7"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add Sub-Question
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(field.subQuestions || []).map((sub, idx) => (
                      <div
                        key={sub.id || idx}
                        className="p-3 bg-background rounded-xl border border-border/60 space-y-2.5 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                            Sub-question #{idx + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Required</span>
                              <Switch
                                checked={Boolean(sub.required)}
                                onCheckedChange={(c) => {
                                  const subs = [...(field.subQuestions || [])];
                                  subs[idx] = { ...subs[idx], required: c };
                                  onUpdate({ subQuestions: subs });
                                }}
                              />
                            </div>
                            {(field.subQuestions?.length || 0) > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const subs = (field.subQuestions || []).filter((_, i) => i !== idx);
                                  onUpdate({ subQuestions: subs });
                                }}
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground font-medium">
                              Sub-Question Label *
                            </Label>
                            <Input
                              value={sub.label}
                              onChange={(e) => {
                                const subs = [...(field.subQuestions || [])];
                                subs[idx] = { ...subs[idx], label: e.target.value };
                                onUpdate({ subQuestions: subs });
                              }}
                              placeholder="e.g. Mother's Name"
                              className="h-9 text-xs bg-background rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground font-medium">
                              Placeholder Text
                            </Label>
                            <Input
                              value={sub.placeholder || ""}
                              onChange={(e) => {
                                const subs = [...(field.subQuestions || [])];
                                subs[idx] = { ...subs[idx], placeholder: e.target.value };
                                onUpdate({ subQuestions: subs });
                              }}
                              placeholder="e.g. Enter full name..."
                              className="h-9 text-xs bg-background rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : field.type === "file_upload" ? (
                <div className="space-y-4 rounded-xl bg-muted/30 p-4 border border-border/50">
                  {/* Google Drive Status Indicator */}
                  {isGoogleDriveConnected ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Google Drive Connected</p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          Uploaded files will be compressed to a maximum of 300 KB and stored securely in Google Drive.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">⚠ Google Drive Not Connected</p>
                          <p className="text-amber-800/80 dark:text-amber-400 text-[11px] leading-relaxed">
                            Google Drive must be connected before this file upload field can be used.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => window.open("/admin/settings?tab=security", "_blank")}
                        className="text-xs shrink-0 h-8 gap-1.5 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 font-medium"
                      >
                        <HardDrive className="h-3.5 w-3.5" />
                        Configure Google Drive
                      </Button>
                    </div>
                  )}

                  {/* File Upload Field Configuration */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Allowed File Types</Label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {["JPG", "PNG", "WEBP", "PDF"].map((ext) => {
                          const currentTypes = field.allowedFileTypes || ["jpg", "jpeg", "png", "webp", "pdf"];
                          const isChecked = currentTypes.some((t) => t.toLowerCase().includes(ext.toLowerCase()));
                          return (
                            <Badge
                              key={ext}
                              variant={isChecked ? "default" : "outline"}
                              className={`cursor-pointer text-xs px-2.5 py-1 select-none transition-all ${
                                isChecked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/50"
                              }`}
                              onClick={() => {
                                let updated: string[];
                                if (isChecked) {
                                  updated = currentTypes.filter((t) => !t.toLowerCase().includes(ext.toLowerCase()));
                                } else {
                                  updated = [...currentTypes, ext.toLowerCase()];
                                }
                                onUpdate({ allowedFileTypes: updated });
                              }}
                            >
                              {isChecked && <Check className="mr-1 h-3 w-3" />}
                              {ext}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">File Size Limits</Label>
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max Upload Size:</span>
                          <span className="font-semibold text-foreground">5 MB</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Target in Drive:</span>
                          <span className="font-mono font-medium text-primary">≤ 300 KB</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium text-foreground">Multiple Files</Label>
                        <p className="text-[10px] text-muted-foreground">Allow uploading more than 1 file</p>
                      </div>
                      <Switch
                        checked={Boolean(field.multipleFiles)}
                        onCheckedChange={(checked) => onUpdate({ multipleFiles: checked, maxFiles: checked ? 3 : 1 })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium text-foreground">Image-Only Mode</Label>
                        <p className="text-[10px] text-muted-foreground">Restricts uploads strictly to images</p>
                      </div>
                      <Switch
                        checked={Boolean(field.imageOnly)}
                        onCheckedChange={(checked) =>
                          onUpdate({
                            imageOnly: checked,
                            allowedFileTypes: checked ? ["jpg", "jpeg", "png", "webp"] : ["jpg", "jpeg", "png", "webp", "pdf"],
                          })
                        }
                      />
                    </div>
                  </div>

                  {field.multipleFiles && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Maximum Number of Files</Label>
                      <Select
                        value={String(field.maxFiles ?? 3)}
                        onValueChange={(v) => onUpdate({ maxFiles: Number(v) })}
                      >
                        <SelectTrigger className="h-9 bg-background rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="2" className="text-xs">2 files</SelectItem>
                          <SelectItem value="3" className="text-xs">3 files</SelectItem>
                          <SelectItem value="5" className="text-xs">5 files</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/40 text-[11px] text-muted-foreground">
                    <span>Compression Requirement</span>
                    <span className="font-semibold font-mono text-primary">Maximum 300 KB</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer" title="Duplicate"><Copy className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={onDelete} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer" title="Delete"><Trash2 className="h-4 w-4" /></Button>

                {/* Branching Toggle for Radio/Dropdown */}
                {(field.type === "radio" || field.type === "dropdown") && sections.length > 1 && (
                  <Button
                    type="button"
                    variant={field.goToSectionBasedOnAnswer ? "default" : "outline"}
                    size="sm"
                    onClick={() => onUpdate({ goToSectionBasedOnAnswer: !field.goToSectionBasedOnAnswer })}
                    className={`h-8 text-xs rounded-lg gap-1.5 ml-1 transition-all cursor-pointer ${
                      field.goToSectionBasedOnAnswer
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground border-border/60"
                    }`}
                    title="Go to section based on answer"
                  >
                    <Split className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Go to section based on answer</span>
                    <span className="sm:hidden">Branching</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-muted-foreground">Required</span>
                <Switch checked={field.required} onCheckedChange={(c) => onUpdate({ required: c })} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {field.imageKey && <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/30"><Image src={getImageUrl(field.imageKey)} alt="" fill className="object-cover" /></div>}
            <p className="text-sm font-medium text-foreground">{field.label || "Untitled Question"}{field.required && <span className="text-destructive ml-1">*</span>}</p>
            {field.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {getFieldDescriptionText(field.description)}
              </p>
            )}
            <div className="pt-1">
              {field.type === "short_text" || field.type === "email" || field.type === "number" ? <Input disabled placeholder="Short answer text" className="max-w-xs bg-muted/10 border-dashed text-muted-foreground h-9 rounded-lg" />
                : field.type === "long_text" ? <Textarea disabled placeholder="Long answer text" rows={2} className="bg-muted/10 border-dashed text-muted-foreground resize-none rounded-lg" />
                : field.type === "date" ? <Input type="date" disabled className="w-40 bg-muted/10 border-dashed h-9 rounded-lg" />
                : field.type === "multi_input" ? (
                  <div className="space-y-2 pt-1">
                    {(field.subQuestions || []).map((sub, i) => (
                      <div key={i} className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          {sub.label || `Sub-question ${i + 1}`}
                          {field.required && sub.required && <span className="text-destructive ml-1">*</span>}
                        </label>
                        <Input disabled placeholder={sub.placeholder || "Enter answer..."} className="max-w-md bg-muted/10 border-dashed text-muted-foreground h-9 rounded-lg text-xs" />
                      </div>
                    ))}
                  </div>
                ) : field.type === "radio" || field.type === "checkbox" || field.type === "dropdown" ? (
                  field.type === "radio" ? (
                    <RadioGroup disabled className="space-y-1.5">
                      {(field.options || ["Option 1"]).slice(0, 3).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RadioGroupItem value={`opt-${i}`} disabled className="h-3.5 w-3.5" />
                          <span>{opt}</span>
                        </div>
                      ))}
                      {(field.options?.length || 0) > 3 && <p className="text-xs text-muted-foreground/60 pl-5">+{(field.options?.length || 0) - 3} more</p>}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-1.5">
                      {(field.options || ["Option 1"]).slice(0, 3).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          {field.type === "checkbox" ? <Checkbox disabled className="h-3.5 w-3.5" /> : <span className="w-3 text-center">{i + 1}.</span>}
                          <span>{opt}</span>
                        </div>
                      ))}
                      {(field.options?.length || 0) > 3 && <p className="text-xs text-muted-foreground/60 pl-5">+{(field.options?.length || 0) - 3} more</p>}
                    </div>
                  )
                ) : field.type === "linear_scale" ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from(
                        { length: (field.scaleMax ?? 5) - (field.scaleMin ?? 1) + 1 },
                        (_, idx) => (field.scaleMin ?? 1) + idx
                      ).map((num) => (
                        <div key={num} className="w-8 h-8 rounded-lg border border-border bg-muted/20 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {num}
                        </div>
                      ))}
                    </div>
                    {(field.scaleMinLabel || field.scaleMaxLabel) && (
                      <div className="flex justify-between text-[11px] text-muted-foreground max-w-xs px-0.5">
                        <span>{field.scaleMinLabel || ""}</span>
                        <span>{field.scaleMaxLabel || ""}</span>
                      </div>
                    )}
                  </div>
                ) : field.type === "button" ? <Button variant="outline" size="sm" type="button" className="text-primary border-primary/30 text-xs h-7 rounded-lg"><ExternalLink className="mr-1.5 h-3 w-3" />{field.buttonLabel || "Open link"}</Button>
                : field.type === "payment" ? <div className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg"><CreditCard className="h-3.5 w-3.5" />Payment enabled</div>
                : field.type === "file_upload" ? (
                  <div className="border border-dashed border-border/80 rounded-xl p-3 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span>File Upload (Compressed to ≤ 300 KB in Google Drive)</span>
                    </div>
                    <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded">
                      {field.multipleFiles ? `Up to ${field.maxFiles || 3} files` : "Single file"}
                    </span>
                  </div>
                )
                : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main FormBuilder ─── */

export default function FormBuilder({ initialDefinition, initialForm }: FormBuilderProps) {
  const router = useRouter();
  const isEditing = Boolean(initialForm);
  const initialData = initialForm?.definition ?? initialDefinition ?? createBlankFormDefinition();

  const [title, setTitle] = useState(initialForm?.title || "Untitled form");
  const [description, setDescription] = useState(initialForm?.description || "");
  const [definition, setDefinition] = useState<FormDefinition>(normalizeDefinition(initialData));
  const [activeTab, setActiveTab] = useState<"questions" | "settings">("questions");
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean | null>(null);
  const [showPublishGuardDialog, setShowPublishGuardDialog] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isBannerSidebarOpen, setIsBannerSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const debouncedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check Google Drive connection status
  useEffect(() => {
    async function checkDrive() {
      try {
        const res = await fetch("/api/settings/google-drive/status");
        const json = await res.json();
        if (json.success && json.data) {
          setIsGoogleDriveConnected(Boolean(json.data.isConnected));
        } else {
          setIsGoogleDriveConnected(false);
        }
      } catch {
        setIsGoogleDriveConnected(false);
      }
    }
    checkDrive();
  }, []);

  /* ─── Responses sidebar state (for detail sheet) ─── */
  const [viewingResponse, setViewingResponse] = useState<FormResponseSummary | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const safeIdx = Math.min(activeSectionIdx, definition.sections.length - 1);
  const currentSection = definition.sections[safeIdx] || emptySection(0);

  /* ─── Section operations ─── */
  const addSection = () => {
    const newSection = emptySection(definition.sections.length);
    setDefinition((c) => ({ ...c, sections: [...c.sections, newSection] }));
    setActiveSectionIdx(definition.sections.length);
    setActiveFieldId(null);
  };

  const deleteSection = (idx: number) => {
    if (definition.sections.length <= 1) { toast.error("A form must have at least one section"); return; }
    setDefinition((c) => ({
      ...c,
      sections: c.sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })),
    }));
    setActiveSectionIdx(Math.max(0, idx - 1));
    setActiveFieldId(null);
  };

  const updateSection = (idx: number, patch: Partial<FormSectionDefinition>) => {
    setDefinition((c) => ({ ...c, sections: c.sections.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  };

  /* ─── Field operations ─── */
  const addField = (type: FormFieldType = "radio") => {
    const f = emptyField(type, currentSection.fields.length);
    if (activeFieldId && activeFieldId !== "title" && activeFieldId !== "section") {
      const activeIdx = currentSection.fields.findIndex((field) => field.id === activeFieldId);
      if (activeIdx !== -1) {
        const newFields = [...currentSection.fields];
        newFields.splice(activeIdx + 1, 0, f);
        const reordered = newFields.map((field, idx) => ({ ...field, order: idx }));
        setDefinition((c) => ({
          ...c,
          sections: c.sections.map((s, i) => (i === safeIdx ? { ...s, fields: reordered } : s)),
        }));
        setActiveFieldId(f.id);

        // Auto-scroll to the newly created question
        setTimeout(() => {
          const el = document.getElementById(`field-card-${f.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 80);
        return;
      }
    }
    setDefinition((c) => ({
      ...c,
      sections: c.sections.map((s, i) => (i === safeIdx ? { ...s, fields: [...s.fields, f] } : s)),
    }));
    setActiveFieldId(f.id);

    // Auto-scroll to the newly created question
    setTimeout(() => {
      const el = document.getElementById(`field-card-${f.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  const updateField = (id: string, patch: Partial<FormFieldDefinition>) => {
    setDefinition((c) => ({ ...c, sections: c.sections.map((s, i) => i === safeIdx ? { ...s, fields: s.fields.map((f) => f.id === id ? { ...f, ...patch } : f) } : s) }));
  };

  const deleteField = (id: string) => {
    setDefinition((c) => ({ ...c, sections: c.sections.map((s, i) => i === safeIdx ? { ...s, fields: s.fields.filter((f) => f.id !== id) } : s) }));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const duplicateField = (id: string) => {
    const src = currentSection.fields.find((f) => f.id === id);
    if (!src) return;
    const clone: FormFieldDefinition = { ...src, id: createId("field"), label: `${src.label} (Copy)`, order: currentSection.fields.length, options: src.options ? [...src.options] : ["Option 1"] };
    setDefinition((c) => ({ ...c, sections: c.sections.map((s, i) => i === safeIdx ? { ...s, fields: [...s.fields, clone] } : s) }));
    setActiveFieldId(clone.id);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oi = currentSection.fields.findIndex((f) => `field:${currentSection.id}:${f.id}` === active.id);
    const ni = currentSection.fields.findIndex((f) => `field:${currentSection.id}:${f.id}` === over.id);
    if (oi >= 0 && ni >= 0) {
      setDefinition((c) => ({ ...c, sections: c.sections.map((s, i) => i === safeIdx ? { ...s, fields: reorder(s.fields, oi, ni).map((f, idx) => ({ ...f, order: idx })) } : s) }));
    }
  };

  // ─── Debounced Auto-Save (2s delay without repeated server spam) ───
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus("unsaved");

    // Local draft cache backup
    try {
      const draftKey = `form_builder_draft_${initialForm?.formId || "new"}`;
      localStorage.setItem(
        draftKey,
        JSON.stringify({ title, description, definition, updatedAt: new Date().toISOString() })
      );
    } catch {
      // ignore quota error
    }

    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }

    debouncedTimerRef.current = setTimeout(async () => {
      if (!title.trim()) return;
      setSaveStatus("saving");

      try {
        const normalized = normalizeDefinition(definition);
        const result =
          isEditing && initialForm
            ? await updateForm(initialForm.formId, { title, description, definition: normalized })
            : await createForm({ title, description, definition: normalized });

        if (result.status === "success") {
          setSaveStatus("saved");
          const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setLastSavedTime(timeStr);
          if (!isEditing && result.data?.formId) {
            router.push(`/admin/forms/${result.data.formId}`);
          }
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus("error");
      }
    }, 2000);

    return () => {
      if (debouncedTimerRef.current) {
        clearTimeout(debouncedTimerRef.current);
      }
    };
  }, [title, description, definition, isEditing, initialForm, router]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Form title is required"); return; }
    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }
    const normalized = normalizeDefinition(definition);
    setIsSaving(true);
    setSaveStatus("saving");
    const result = isEditing && initialForm
      ? await updateForm(initialForm.formId, { title, description, definition: normalized })
      : await createForm({ title, description, definition: normalized });
    if (result.status === "success") {
      setSaveStatus("saved");
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSavedTime(timeStr);
      toast.success(result.message);
      if (!isEditing && result.data?.formId) { router.push(`/admin/forms/${result.data.formId}`); } else { router.refresh(); }
    } else {
      setSaveStatus("error");
      toast.error(result.message);
    }
    setIsSaving(false);
  };

  const handlePublishToggle = async () => {
    if (!initialForm) { toast.error("Save form first before publishing"); return; }

    const willPublish = !initialForm.isPublished;
    if (willPublish) {
      const hasFileUpload = definition.sections.some((s) =>
        s.fields.some((f) => f.type === "file_upload")
      );
      if (hasFileUpload && !isGoogleDriveConnected) {
        setShowPublishGuardDialog(true);
        return;
      }
    }

    setIsPublishing(true);
    const result = await toggleFormPublish(initialForm.formId, willPublish);
    if (result.status === "success") { toast.success(result.message); router.refresh(); } else { toast.error(result.message); }
    setIsPublishing(false);
  };

  const responses = initialForm?.responses || [];
  const isPublished = initialForm?.isPublished;
  const currentTemplate = BANNER_TEMPLATES.find((t) => t.id === (definition.bannerTemplate || "none"));
  const hasBanner = definition.bannerKey || (definition.bannerTemplate && definition.bannerTemplate !== "none");
  const formHasPayment = useMemo(() => definition.sections.some((s) => s.fields.some((f) => f.type === "payment")), [definition]);
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {
      name: "Full Name",
      email: "Email Address",
    };
    definition.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.id && f.label) {
          map[f.id] = f.label;
        }
      });
    });
    return map;
  }, [definition]);


  /* ─── Response actions ─── */
  const handleSingleStatusUpdate = async (id: string, status: string) => {
    setIsActionLoading(true);
    const r = await updateFormResponseStatus(id, status);
    if (r.status === "success") {
      toast.success(r.message);
      router.refresh();
    } else {
      toast.error(r.message);
    }
    setIsActionLoading(false);
  };

  const handleSingleDelete = async () => {
    if (!singleDeleteId) return;
    setIsActionLoading(true);
    const r = await deleteFormResponse(singleDeleteId);
    if (r.status === "success") {
      toast.success(r.message);
      setSingleDeleteId(null);
      router.refresh();
    } else {
      toast.error(r.message);
    }
    setIsActionLoading(false);
  };


  const TABS = [
    { id: "questions" as const, label: "Questions", icon: HelpCircle },
    { id: "settings" as const, label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="min-h-full flex-1 bg-muted/30 text-foreground flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-xs">
        <div className="flex items-center h-14 px-3 sm:px-6 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/70" onClick={() => router.push("/admin/forms")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30"><FileText className="h-4 w-4 text-primary-foreground" /></div>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground min-w-0 w-48 sm:w-64 truncate focus:bg-muted/50 focus:px-2 focus:rounded-lg transition-all" placeholder="Untitled form" />
              <button type="button" onClick={() => setIsStarred(!isStarred)} className={`p-1.5 rounded-lg transition-all ${isStarred ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"}`}>
                <Star className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Auto-save status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  <span className="hidden md:inline text-primary font-medium">Saving...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="hidden md:inline text-emerald-600 font-medium">
                    {lastSavedTime ? `Auto-saved ${lastSavedTime}` : "Saved"}
                  </span>
                </>
              ) : saveStatus === "unsaved" ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="hidden md:inline text-amber-500 font-medium">Unsaved</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="hidden md:inline text-destructive font-medium">Save error</span>
                </>
              )}
            </div>

            <ThemeSelectorDropdown />
            <Button variant="ghost" size="icon" onClick={() => setIsBannerSidebarOpen(true)} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70" title="Banner Settings">
              <Palette className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { if (initialForm?.formId) window.open(`https://forms.cbgcek.dev/${initialForm.formId}`, "_blank"); else toast.info("Save first to preview"); }} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70" title="Preview"><Eye className="h-4 w-4" /></Button>
            {initialForm && <Button variant="ghost" size="icon" onClick={async () => { await navigator.clipboard.writeText(`https://forms.cbgcek.dev/${initialForm.formId}`); toast.success("Short URL (forms.cbgcek.dev) copied!"); }} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70" title="Copy link"><Link2 className="h-4 w-4" /></Button>}
            <Button onClick={handleSave} disabled={isSaving} variant="outline" size="sm" className="hidden sm:flex h-8 rounded-xl border-border/70 text-xs font-medium">
              {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}Save
            </Button>
            <Button onClick={handlePublishToggle} disabled={isPublishing || !initialForm} size="sm"
              className={`h-8 rounded-xl text-xs font-semibold px-4 transition-all ${isPublished ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30" : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/30"}`}>
              {isPublishing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : isPublished ? <Globe className="mr-1.5 h-3 w-3" /> : <Lock className="mr-1.5 h-3 w-3" />}
              {isPublished ? "Live" : "Publish"}
            </Button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex justify-center border-t border-border/30 bg-background/50">
          <div className="flex">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-6 py-2.5 text-xs font-semibold transition-all ${activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ BANNER SELECTION RIGHT SIDEBAR ═══ */}
      <BannerSidebarSheet
        isOpen={isBannerSidebarOpen}
        onClose={() => setIsBannerSidebarOpen(false)}
        bannerKey={definition.bannerKey}
        bannerTemplate={definition.bannerTemplate}
        onChangeBannerKey={(key) => setDefinition((c) => ({ ...c, bannerKey: key }))}
        onChangeBannerTemplate={(id) => setDefinition((c) => ({ ...c, bannerTemplate: id }))}
      />

      {/* ═══ RESPONSE DETAILS SHEET ═══ */}
      <Sheet open={Boolean(viewingResponse)} onOpenChange={(open) => { if (!open) setViewingResponse(null); }} modal>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex h-dvh max-h-screen flex-col overflow-hidden">
          <div className="shrink-0 border-b bg-background px-6 pt-6 pb-4">
            <SheetHeader>
              <SheetTitle className="text-base font-bold flex items-center justify-between">
                <span>Response {viewingResponse ? `#${viewingResponse.id.slice(0, 8).toUpperCase()}` : ""}</span>
                {viewingResponse && (
                  <Badge variant={viewingResponse.paymentStatus === "verified" ? "default" : viewingResponse.paymentStatus === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize rounded-lg">
                    {viewingResponse.paymentStatus}
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Submitted on {viewingResponse ? new Date(viewingResponse.createdAt).toLocaleString() : ""}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4" onWheel={(e) => e.stopPropagation()} onTouchMoveCapture={(e) => e.stopPropagation()}>
            {viewingResponse && (
              <div className="space-y-4">
                {viewingResponse.transactionId && (
                  <div className="bg-muted/40 rounded-xl p-3.5 border border-border/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Transaction ID</p>
                      <p className="text-sm font-mono text-foreground font-semibold">{viewingResponse.transactionId}</p>
                    </div>
                    {viewingResponse.paymentStatus === "verified" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/receipt/${viewingResponse.id}`)}
                        className="h-8 rounded-xl text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1.5 shrink-0 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Receipt
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted Answers</p>
                  {Object.entries((viewingResponse.answers as Record<string, unknown>) || {}).map(([k, v]) => {
                    const displayLabel = fieldLabelMap[k] || (k.toLowerCase() === "name" ? "Full Name" : k.toLowerCase() === "email" ? "Email Address" : k);
                    return (
                      <div key={k} className="bg-card rounded-xl p-3.5 border border-border/60 shadow-xs space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{displayLabel}</p>
                        <p className="text-sm font-semibold text-foreground">{Array.isArray(v) ? v.join(", ") : String(v ?? "—")}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {viewingResponse && (
            <div className="shrink-0 border-t bg-background px-6 py-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => handleSingleStatusUpdate(viewingResponse.id, "verified")} disabled={isActionLoading}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => handleSingleStatusUpdate(viewingResponse.id, "rejected")} disabled={isActionLoading}>
                <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Reject
              </Button>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => { setSingleDeleteId(viewingResponse.id); setViewingResponse(null); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>



      {/* ═══ SINGLE DELETE CONFIRMATION DIALOG ═══ */}
      <AlertDialog open={Boolean(singleDeleteId)} onOpenChange={(open) => { if (!open) setSingleDeleteId(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Response?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this form response? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSingleDelete} disabled={isActionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete Response"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* ═══ MAIN ═══ */}
      <main className="flex-1 py-8">

        {/* ─── QUESTIONS TAB ─── */}
        {activeTab === "questions" && (
          <div className="max-w-3xl mx-auto px-4 md:pr-16 relative">
            <div className="space-y-3 min-w-0">

              {/* Title & Banner Card */}
              <div
                className={`bg-card rounded-2xl border border-border/60 shadow-sm relative transition-all ${
                  activeFieldId === "title" ? "ring-2 ring-primary/20" : ""
                }`}
                onClick={() => setActiveFieldId("title")}
              >
                {/* Side toolbar anchored to Title Card when active */}
                {activeFieldId === "title" && (
                  <div className="hidden md:flex absolute -right-12 sm:-right-14 top-4 z-30">
                    <AdaptiveSideToolbar
                      onAddField={addField}
                      onAddSection={addSection}
                      onOpenBanner={() => setIsBannerSidebarOpen(true)}
                    />
                  </div>
                )}

                <div
                  className={`relative w-full cursor-pointer group transition-all overflow-hidden rounded-t-2xl ${
                    hasBanner ? "h-40" : "h-14 border-b border-dashed border-border/50 hover:border-primary/40"
                  }`}
                  onClick={() => setIsBannerSidebarOpen(true)}
                >
                  {definition.bannerKey ? (
                    <>
                      <Image src={getImageUrl(definition.bannerKey)} alt="Banner" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/60 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                          <Palette className="h-4 w-4" /> Change banner (Right Sidebar)
                        </span>
                      </div>
                    </>
                  ) : currentTemplate && currentTemplate.id !== "none" ? (
                    <>
                      <div
                        className={`w-full h-full bg-gradient-to-r ${currentTemplate.gradient}`}
                        style={{ background: currentTemplate.cssGradient }}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/60 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                          <Palette className="h-4 w-4" /> Change banner (Right Sidebar)
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center gap-2 text-muted-foreground/60 hover:text-foreground">
                      <LayoutTemplate className="h-4 w-4" />
                      <span className="text-xs font-medium">Add header banner (Opens right sidebar)</span>
                    </div>
                  )}
                </div>

                {!hasBanner && <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />}
                <div className="p-6 space-y-3">
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form Title" className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50" />
                  <MiniRichEditor
                    value={description}
                    onChange={(val) => setDescription(val)}
                    placeholder="Add a description..."
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {definition.settings.collectEmail ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Collecting emails</> : <><X className="h-3 w-3 text-muted-foreground/50" /> Email off</>}
                    </span>
                    <button type="button" onClick={() => setActiveTab("settings")} className="text-primary hover:underline font-medium">Settings</button>
                  </div>
                </div>
              </div>

              {/* Section tabs */}
              {definition.sections.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {definition.sections.map((sec, i) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => { setActiveSectionIdx(i); setActiveFieldId(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${i === safeIdx ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
                    >
                      <Layers className="h-3 w-3" />
                      {sec.title || `Section ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Active section header editor */}
              <div
                className={`bg-card rounded-2xl border border-l-4 border-l-primary border-border/60 shadow-sm p-5 space-y-3 relative transition-all ${
                  activeFieldId === "section" || (activeFieldId === null && currentSection.fields.length === 0)
                    ? "ring-2 ring-primary/20"
                    : ""
                }`}
                onClick={() => setActiveFieldId("section")}
              >
                {/* Side toolbar anchored to Section Card when active or when form has no questions */}
                {(activeFieldId === "section" || (activeFieldId === null && currentSection.fields.length === 0)) && (
                  <div className="hidden md:flex absolute -right-12 sm:-right-14 top-4 z-30">
                    <AdaptiveSideToolbar
                      onAddField={addField}
                      onAddSection={addSection}
                      onOpenBanner={() => setIsBannerSidebarOpen(true)}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Layers className="h-4 w-4 text-primary shrink-0" />
                    <input
                      type="text"
                      value={currentSection.title}
                      onChange={(e) => updateSection(safeIdx, { title: e.target.value })}
                      placeholder={`Section ${safeIdx + 1} title`}
                      className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:bg-muted/30 focus:px-2 focus:rounded-lg transition-all"
                    />
                  </div>
                  {definition.sections.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteSection(safeIdx)} className="h-7 w-7 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" title="Delete section">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <MiniRichEditor
                  value={currentSection.description || ""}
                  onChange={(val) => updateSection(safeIdx, { description: val })}
                  placeholder="Section description (optional)"
                />

                {/* After section action selector (Google Forms style) */}
                {definition.sections.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" /> After section {safeIdx + 1}:
                    </span>
                    <Select
                      value={currentSection.afterSectionAction || "next"}
                      onValueChange={(val) => updateSection(safeIdx, { afterSectionAction: val })}
                    >
                      <SelectTrigger className="w-56 sm:w-64 h-8 bg-background border-border/60 text-xs rounded-lg font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="next" className="text-xs">Continue to next section</SelectItem>
                        {definition.sections
                          .filter((sec) => sec.id !== currentSection.id)
                          .map((sec) => {
                            const sIdx = definition.sections.findIndex((s) => s.id === sec.id);
                            return (
                              <SelectItem key={sec.id} value={`section_${sec.id}`} className="text-xs">
                                Go to section {sIdx + 1} ({sec.title || `Section ${sIdx + 1}`})
                              </SelectItem>
                            );
                          })}
                        <SelectItem value="submit" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Submit form
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <span className="text-[11px] text-muted-foreground/70">
                    {safeIdx + 1} of {definition.sections.length} sections
                    {safeIdx < definition.sections.length - 1 && <span className="ml-2 inline-flex items-center gap-1">→ next: <span className="font-medium">{definition.sections[safeIdx + 1]?.title}</span></span>}
                  </span>
                </div>
              </div>

              {/* Question cards */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={currentSection.fields.map((f) => `field:${currentSection.id}:${f.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {currentSection.fields.map((field) => (
                      <QuestionCard
                        key={field.id}
                        sectionId={currentSection.id}
                        field={field}
                        isActive={activeFieldId === field.id}
                        isGoogleDriveConnected={isGoogleDriveConnected}
                        sections={definition.sections}
                        onSelect={() => setActiveFieldId(field.id)}
                        onUpdate={(patch) => updateField(field.id, patch)}
                        onDelete={() => deleteField(field.id)}
                        onDuplicate={() => duplicateField(field.id)}
                        onAddField={addField}
                        onAddSection={addSection}
                        onOpenBanner={() => setIsBannerSidebarOpen(true)}
                      />
                    ))}
                    {currentSection.fields.length === 0 && (
                      <div
                        onClick={() => addField("radio")}
                        className="bg-card rounded-2xl border-2 border-dashed border-border/70 hover:border-primary/50 hover:bg-primary/5 p-10 text-center space-y-3 cursor-pointer transition-all group"
                      >
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center mx-auto transition-all shadow-sm">
                          <Plus className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">Add your first question</p>
                        <p className="text-xs text-muted-foreground">Click here or use the toolbar on the right</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Mobile floating action bar */}
            <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1.5">
              <AdaptiveSideToolbar
                onAddField={addField}
                onAddSection={addSection}
                onOpenBanner={() => setIsBannerSidebarOpen(true)}
                isMobileHorizontal
              />
            </div>
          </div>
        )}

        {/* ═══ PUBLISH GUARD DIALOG (GOOGLE DRIVE NOT CONNECTED) ═══ */}
        <AlertDialog open={showPublishGuardDialog} onOpenChange={setShowPublishGuardDialog}>
          <AlertDialogContent className="rounded-2xl max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <AlertDialogTitle className="text-base font-semibold">Configuration Required</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed">
                This form contains a file upload field, but Google Drive is not connected.
                <br /><br />
                Connect Google Drive before publishing this form.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowPublishGuardDialog(false);
                  window.open("/admin/settings?tab=security", "_blank");
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-medium"
              >
                Go to Google Drive Settings
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* ─── SETTINGS TAB ─── */}
        {activeTab === "settings" && (
          <div className="max-w-xl mx-auto px-4 space-y-4">
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/40 bg-muted/30"><h2 className="text-sm font-semibold text-foreground">Form Settings</h2><p className="text-xs text-muted-foreground mt-0.5">Configure how this form behaves</p></div>
              <div className="divide-y divide-border/40">
                {[
                  { label: "Collect Email Addresses", desc: "Require respondents to provide their email", checked: definition.settings.collectEmail, onChange: (v: boolean) => setDefinition((c) => ({ ...c, settings: { ...c.settings, collectEmail: v } })) },
                  { label: "Collect Full Name", desc: "Require respondents to provide their name", checked: definition.settings.collectName, onChange: (v: boolean) => setDefinition((c) => ({ ...c, settings: { ...c.settings, collectName: v } })) },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between px-6 py-4">
                    <div><p className="text-sm font-medium text-foreground">{s.label}</p><p className="text-xs text-muted-foreground">{s.desc}</p></div>
                    <Switch checked={s.checked} onCheckedChange={s.onChange} />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/40 bg-muted/30"><h2 className="text-sm font-semibold text-foreground">Response Settings</h2></div>
              <div className="p-6 space-y-5">
                <div className="space-y-2"><Label className="text-sm font-medium text-foreground">Submit Button Label</Label><Input value={definition.settings.submitButtonLabel} onChange={(e) => setDefinition((c) => ({ ...c, settings: { ...c.settings, submitButtonLabel: e.target.value } }))} className="rounded-xl" /></div>
                <div className="space-y-2"><Label className="text-sm font-medium text-foreground">Success Message</Label><Textarea value={definition.settings.successMessage} onChange={(e) => setDefinition((c) => ({ ...c, settings: { ...c.settings, successMessage: e.target.value } }))} rows={3} className="rounded-xl resize-none" /></div>
              </div>
            </div>
            {initialForm && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 bg-muted/30"><h2 className="text-sm font-semibold text-foreground">Form Info</h2></div>
                <div className="p-6 space-y-3 text-sm">
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Form ID</span><span className="font-mono text-xs bg-muted px-2 py-1 rounded-lg">{initialForm.formId}</span></div>
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Sections</span><span className="text-xs font-medium">{definition.sections.length}</span></div>
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><Badge variant={isPublished ? "default" : "secondary"} className="rounded-lg text-xs">{isPublished ? "Published" : "Draft"}</Badge></div>
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Public URL</span><Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary" onClick={async () => { await navigator.clipboard.writeText(`https://forms.cbgcek.dev/${initialForm.formId}`); toast.success("Copied!"); }}><Link2 className="mr-1 h-3 w-3" /> Copy</Button></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
