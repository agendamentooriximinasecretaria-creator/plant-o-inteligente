import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Heading1, Heading2, Heading3, Table as TableIcon, Image as ImgIcon,
  Link as LinkIcon, Undo, Redo, Code, Pilcrow, Variable
} from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  variaveis?: string[];
  font?: string;
  fontSize?: number;
  lineHeight?: number;
}

export function RichEditor({ value, onChange, variaveis = [], font = 'Times', fontSize = 12, lineHeight = 1.5 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[400px] p-6 focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return <div className="border border-border rounded-lg p-6 text-sm text-muted-foreground">Carregando editor...</div>;

  const Btn = ({ active, onClick, title, children }: any) => (
    <button type="button" onClick={onClick} title={title}
      className={`p-1.5 rounded hover:bg-muted transition ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
      {children}
    </button>
  );

  const insertVar = (v: string) => editor.chain().focus().insertContent(`{{${v}}}`).run();

  const fontFamilyMap: Record<string, string> = {
    Times: '"Times New Roman", Times, serif',
    Arial: 'Arial, Helvetica, sans-serif',
    Helvetica: 'Helvetica, Arial, sans-serif',
    Courier: '"Courier New", Courier, monospace',
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1"><Heading1 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Parágrafo"><Pilcrow className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar esquerda"><AlignLeft className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar"><AlignCenter className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar direita"><AlignRight className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar"><AlignJustify className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Tabela"><TableIcon className="h-4 w-4" /></Btn>
        <Btn onClick={() => {
          const url = window.prompt('URL da imagem');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} title="Imagem"><ImgIcon className="h-4 w-4" /></Btn>
        <Btn onClick={() => {
          const url = window.prompt('URL do link');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} title="Link"><LinkIcon className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1" />
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo className="h-4 w-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo className="h-4 w-4" /></Btn>

        {variaveis.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Variable className="h-4 w-4 text-muted-foreground" />
            <select onChange={(e) => { if (e.target.value) { insertVar(e.target.value); e.target.value = ''; } }}
              className="text-xs bg-card border border-border rounded px-2 py-1">
              <option value="">Inserir variável...</option>
              {variaveis.map(v => <option key={v} value={v}>{`{{${v}}}`}</option>)}
            </select>
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: fontFamilyMap[font] || fontFamilyMap.Times,
          fontSize: `${fontSize}pt`,
          lineHeight,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
