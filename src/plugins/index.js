import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export function registerPlugins(app) {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'dark',
      themes: {
        dark: {
          dark: true,
          colors: {
            primary: '#8E44AD',
            secondary: '#3498DB',
            accent: '#F1C40F',
          },
        },
      },
    },
  });

  app.use(vuetify);
}
