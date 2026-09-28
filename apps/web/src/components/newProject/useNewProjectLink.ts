import { useCallback } from 'react'
import { useLocation, type To } from 'react-router'
import { withNewProject, type NewProjectContext } from './newProjectModel'

/**
 * Ссылки, открывающие окно «Новый проект» поверх текущей страницы с её параметрами (D-84).
 * Возвращает функцию: одной страницы хватает на несколько кнопок с разным контекстом (карточка процесса, К-3).
 */
export function useNewProjectLink(): (context?: NewProjectContext) => To {
  const { pathname, search } = useLocation()
  return useCallback(
    (context: NewProjectContext = {}) => ({ pathname, search: withNewProject(new URLSearchParams(search), context) }),
    [pathname, search],
  )
}
