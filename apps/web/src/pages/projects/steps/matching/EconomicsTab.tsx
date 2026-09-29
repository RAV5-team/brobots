import { ru } from '@/shared/i18n/ru'
import { AmountRows, DetailRows, DetailsGroup } from './detailsParts'
import type { EconomicsView } from './economicsTabModel'

const e = ru.project.matching.details.economics

/**
 * Вкладка «Экономика» окна 2.1а (16832:1141): цена и источник, состав CAPEX и OPEX, чистый эффект по статьям,
 * условия RaaS (только у RaaS) и «Как рассчитано». Числа — варианта рейтинга 2.1 выбранной модели приобретения.
 */
export function EconomicsTab({ view }: { readonly view: EconomicsView }) {
  return (
    <div className="flex flex-col gap-20">
      <DetailsGroup id="economics-price" title={e.priceTitle}><DetailRows rows={view.price} /></DetailsGroup>
      <DetailsGroup id="economics-capex" title={view.capex.title}>
        {view.capex.items.length === 0 ? <p className="py-8 type-body text-text-secondary">{e.noItems}</p> : <AmountRows rows={view.capex.items} />}
      </DetailsGroup>
      <DetailsGroup id="economics-opex" title={view.opex.title} note={view.opex.caption}>
        {view.opex.items.length === 0 ? <p className="py-8 type-body text-text-secondary">{e.noItems}</p> : <AmountRows rows={view.opex.items} />}
      </DetailsGroup>
      <DetailsGroup id="economics-effect" title={e.effectTitle}><AmountRows rows={view.effect} /></DetailsGroup>
      {view.raas && (
        <DetailsGroup id="economics-raas" title={e.raasTitle} note={view.raas.pending ? e.raasPending : e.raasNote}>
          <DetailRows rows={view.raas.rows} />
        </DetailsGroup>
      )}
      <DetailsGroup id="economics-formulas" title={e.formulasTitle}><DetailRows rows={view.formulas} /></DetailsGroup>
    </div>
  )
}
