import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'dynamic-form',
        title: 'Dynamic Form',
        loadComponent: () => import('./components/dynamic-form/dynamic-form.component').then(m => m.DynamicFormComponent),
    },
];
