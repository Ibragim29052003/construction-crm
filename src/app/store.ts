import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { crmApi } from '../shared/api/crm-api'
export const store = configureStore({
  reducer: { [crmApi.reducerPath]: crmApi.reducer },
  middleware: (getDefault) => getDefault().concat(crmApi.middleware),
})
setupListeners(store.dispatch)
