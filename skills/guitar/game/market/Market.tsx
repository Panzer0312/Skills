import {
  BUY_REFUSAL_TEXT,
  GEAR,
  GEAR_SLOTS,
  buyCheck,
  gearItem,
  type GameState,
  type GearItem,
} from "@skills/core";
import { useRef, useState } from "react";
import { gameContent, useBuyItem, useEquip, useGameState } from "../api.js";
import { spriteUrl, type SpriteName } from "../assets.js";
import { ToolFrame } from "../Places.js";
import { playEffect } from "../sound/effects.js";
import "./market.css";

const sprite = (item: GearItem) => spriteUrl(item.sprite as SpriteName);

function lessonTitle(id: string | null): string {
  return gameContent.nodes.find((node) => node.id === id)?.title ?? id ?? "";
}

function MarketView({ state }: { state: GameState }) {
  const buy = useBuyItem();
  const equip = useEquip();
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const busy = buy.isPending || equip.isPending;

  const gold = state.gold ?? 0;
  const owned = state.owned ?? [];
  const equipped = state.equipped ?? {};

  async function run(action: () => Promise<unknown>, effect: "coin" | "equip") {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      await action();
      playEffect(effect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      busyRef.current = false;
    }
  }

  const doBuy = (item: GearItem) => run(() => buy.mutateAsync(item.id), "coin");
  const doEquip = (item: GearItem) => run(() => equip.mutateAsync({ slot: item.slot, itemId: item.id }), "equip");
  const doUnequip = (item: GearItem) => run(() => equip.mutateAsync({ slot: item.slot, itemId: null }), "equip");

  return (
    <div className="market">
      <p className="market-gold">
        <img src={spriteUrl("gold")} alt="" /> <b>{gold}</b> Gold
      </p>
      {error ? (
        <p role="alert" className="game-error">
          {error}
        </p>
      ) : null}

      <h2>Deine Ausrüstung</h2>
      <ul className="market-grid market-slots">
        {GEAR_SLOTS.map((slot) => {
          const item = equipped[slot.id] ? gearItem(equipped[slot.id] as string) : undefined;
          return (
            <li key={slot.id} className="market-tile">
              <small>{slot.name}</small>
              {item ? (
                <button type="button" disabled={busy} onClick={() => void doUnequip(item)} aria-label={`${item.name} ablegen`}>
                  <img src={sprite(item)} alt="" />
                  <span>{item.name}</span>
                </button>
              ) : (
                <span className="market-empty">leer</span>
              )}
            </li>
          );
        })}
      </ul>

      <h2>Händler</h2>
      {GEAR_SLOTS.map((slot) => {
        const items = GEAR.filter((item) => item.slot === slot.id && item.price !== null);
        if (items.length === 0) return null;
        return (
          <section key={slot.id} aria-label={slot.name}>
            <h3>{slot.name}</h3>
            <ul className="market-grid">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                const refusal = buyCheck(item.id, gold, owned);
                return (
                  <li key={item.id} className="market-tile">
                    <img src={sprite(item)} alt="" />
                    <b>{item.name}</b>
                    <small>{item.description}</small>
                    <span className="market-price">{item.price} Gold</span>
                    {isOwned ? (
                      <>
                        <span className="market-owned">Gekauft</span>
                        <EquipButton item={item} equipped={equipped} busy={busy} onEquip={doEquip} />
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="game-button"
                          disabled={busy || refusal !== null}
                          aria-label={`${item.name} kaufen`}
                          onClick={() => void doBuy(item)}
                        >
                          Kaufen
                        </button>
                        {refusal ? <small className="market-hint">{BUY_REFUSAL_TEXT[refusal]}</small> : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <h2>Belohnungen</h2>
      <ul className="market-grid">
        {GEAR.filter((item) => item.milestone !== null).map((item) => {
          const isOwned = owned.includes(item.id);
          return (
            <li key={item.id} className={`market-tile${isOwned ? "" : " market-locked"}`}>
              <img src={sprite(item)} alt="" />
              <b>{item.name}</b>
              <small>{item.description}</small>
              {isOwned ? (
                <EquipButton item={item} equipped={equipped} busy={busy} onEquip={doEquip} />
              ) : (
                <small className="market-hint">Verdient durch: {lessonTitle(item.milestone)}</small>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EquipButton({
  item,
  equipped,
  busy,
  onEquip,
}: {
  item: GearItem;
  equipped: GameState["equipped"];
  busy: boolean;
  onEquip: (item: GearItem) => Promise<void>;
}) {
  if (equipped[item.slot] === item.id) return <span className="market-owned">Angelegt</span>;
  return (
    <button
      type="button"
      className="game-button"
      disabled={busy}
      aria-label={`${item.name} anlegen`}
      onClick={() => void onEquip(item)}
    >
      Anlegen
    </button>
  );
}

export function Market() {
  const { data: state } = useGameState();
  return <ToolFrame title="Markt">{state ? <MarketView state={state} /> : <p>Lädt …</p>}</ToolFrame>;
}
