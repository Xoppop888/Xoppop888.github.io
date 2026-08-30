import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Category, CategoryType } from "../types";
import { spentByCategory, useStore } from "../store";
import { Modal, useToast } from "../ui";
import { currentMonthKey, fmtMoney, monthLabel, monthShort } from "../format";

const EMOJIS = ["🍽️", "🛒", "☕", "🚕", "🚌", "⛽", "🏠", "💡", "📶", "💊", "🏋️", "🎬", "📱", "🎮", "👟", "📦", "✈️", "🐶", "🎓", "💇", "🧸", "💼", "💻", "📈", "🎁", "🍰", "🎂", "🏥"];
const COLORS = ["#E8A33D", "#E07856", "#EF6A85", "#D97BA6", "#9A7BD4", "#5B8DEF", "#3E9DC4", "#45C4A0", "#2FA36B", "#8A94A6"];

export default function Categories() {
  const { state, childrenOf, roots, api } = useStore();
  const toast = useToast();
  const [modal, setModal] = useState<{ mode: "add"; type: CategoryType; parentId: string | null } | { mode: "edit"; cat: Category } | null>(null);

  const spent = useMemo(() => spentByCategory(state, currentMonthKey()), [state]);

  const remove = (c: Category) => {
    const res = api.deleteCategory(c.id);
    if (!res.ok) {
      toast.push(res.error, "err");
      return;
    }
    toast.push(`Категория «${c.name}» удалена`, "ok");
  };

  const Section = ({ type }: { type: CategoryType }) => {
    const list = roots(type);
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
          <div className="font-display text-[14px] font-semibold">{type === "EXPENSE" ? "Расходные" : "Доходные"}</div>
          <button
            onClick={() => setModal({ mode: "add", type, parentId: null })}
            className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus size={12} /> корневая
          </button>
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-[var(--faint)]">Категорий нет — добавьте первую.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {list.map((root) => {
              const kids = childrenOf(root.id);
              return (
                <li key={root.id} className="px-4 py-3">
                  <div className="group flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[16px]" style={{ background: `${root.color}1c` }}>
                      {root.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{root.name}</div>
                      <div className="font-mono text-[10.5px] text-[var(--faint)]">
                        {kids.length ? `${kids.length} подкат. · ` : ""}
                        {type === "EXPENSE" && spent[root.id] ? `${fmtMoney(spent[root.id])} за ${monthShort(currentMonthKey())}` : kids.length === 0 ? "без подкатегорий" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      {type === "EXPENSE" && (
                        <button
                          onClick={() => setModal({ mode: "add", type, parentId: root.id })}
                          title="Добавить подкатегорию"
                          className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button onClick={() => setModal({ mode: "edit", cat: root })} aria-label="Изменить" className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)]">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(root)} aria-label="Удалить" className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--expense-soft)] hover:text-[var(--expense)]">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {kids.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-dotted border-[var(--line-strong)] pl-4 sm:ml-4">
                      {kids.map((k) => (
                        <li key={k.id} className="group/kid flex items-center gap-2 rounded-lg py-1.5 pr-1 transition-colors hover:bg-[var(--surface-2)]">
                          <ChevronRight size={12} className="shrink-0 text-[var(--faint)]" />
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px]" style={{ background: `${k.color}1c` }}>
                            {k.icon}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px]">{k.name}</span>
                          {type === "EXPENSE" && spent[k.id] ? <span className="num-tab font-mono text-[11px] text-[var(--muted)]">{fmtMoney(spent[k.id])}</span> : null}
                          <span className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/kid:opacity-100">
                            <button onClick={() => setModal({ mode: "edit", cat: k })} aria-label="Изменить" className="rounded-md p-1 text-[var(--faint)] transition-colors hover:text-[var(--accent)]">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => remove(k)} aria-label="Удалить" className="rounded-md p-1 text-[var(--faint)] transition-colors hover:text-[var(--expense)]">
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Категории</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Дерево «категория → подкатегория» с эмодзи и цветом · траты {monthLabel(currentMonthKey()).toLowerCase()}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 font-mono text-[10.5px] text-[var(--muted)]">
          <Tags size={12} /> {state.categories.length} шт
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section type="EXPENSE" />
        <Section type="INCOME" />
      </div>

      {modal && (
        <CategoryModal
          mode={modal.mode}
          type={modal.mode === "add" ? modal.type : modal.cat.type}
          parentId={modal.mode === "add" ? modal.parentId : modal.cat.parentId}
          cat={modal.mode === "edit" ? modal.cat : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function CategoryModal({
  mode,
  type,
  parentId,
  cat,
  onClose,
}: {
  mode: "add" | "edit";
  type: CategoryType;
  parentId: string | null;
  cat: Category | null;
  onClose: () => void;
}) {
  const { categoriesById, api } = useStore();
  const toast = useToast();
  const [name, setName] = useState(cat?.name ?? "");
  const [icon, setIcon] = useState(cat?.icon ?? (type === "INCOME" ? "💼" : "🛒"));
  const [color, setColor] = useState(cat?.color ?? (type === "INCOME" ? "#2FA36B" : "#E8A33D"));
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setErr("Укажите название");
    if (mode === "add") {
      const res = api.addCategory({ name: name.trim(), type, parentId, icon, color });
      if (!res.ok) return setErr(res.error);
      toast.push(parentId ? "Подкатегория добавлена" : "Категория добавлена", "ok");
    } else if (cat) {
      api.updateCategory({ ...cat, name: name.trim(), icon, color });
      toast.push("Категория обновлена", "ok");
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "add" ? (parentId ? `Подкатегория в «${categoriesById[parentId]?.name ?? ""}»` : `Новая ${type === "INCOME" ? "доходная" : "расходная"} категория`) : "Изменить категорию"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Название</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setErr(null); }}
            placeholder="Например, «Продукты»"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Иконка</div>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[16px] transition-all ${
                  icon === e ? "scale-110 border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--surface-2)]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Цвет</div>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className={`h-8 w-8 rounded-lg border-2 transition-all ${color === c ? "scale-110 border-[var(--ink)]" : "border-transparent hover:scale-105"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {/* предпросмотр */}
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--line-strong)] px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]" style={{ background: `${color}1c` }}>
            {icon}
          </span>
          <span className="text-[13px] font-semibold">{name.trim() || "Предпросмотр"}</span>
        </div>
        {err && <div className="animate-toast rounded-lg border border-[var(--expense)]/50 bg-[var(--expense-soft)] px-3 py-2 text-[12px] font-medium text-[var(--expense)]">{err}</div>}
        <div className="-mx-5 sticky bottom-0 z-10 border-t border-[var(--line)] bg-[var(--surface)] px-5 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <button type="submit" className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-[0.98]">
            {mode === "add" ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
