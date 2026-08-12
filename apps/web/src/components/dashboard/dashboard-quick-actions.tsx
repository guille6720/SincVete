import Link from 'next/link';
import {
  BarChart3,
  BedDouble,
  Calendar,
  FlaskConical,
  Package,
  PawPrint,
  Receipt,
  Scissors,
  Settings,
  Stethoscope,
  Syringe,
  UserPlus,
  Bell,
  Sparkles,
  MessageCircle,
  Pill,
  Banknote,
  Images,
  Inbox,
  ScrollText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardQuickActionsProps {
  canWritePatients: boolean;
}

const ACTIONS = [
  {
    label: 'Nuevo paciente',
    href: '/pacientes/nuevo',
    icon: PawPrint,
    requiresWrite: true,
  },
  {
    label: 'Nuevo propietario',
    href: '/propietarios/nuevo',
    icon: UserPlus,
    requiresWrite: true,
  },
  {
    label: 'Ver agenda',
    href: '/agenda',
    icon: Calendar,
    requiresWrite: false,
  },
  {
    label: 'Nueva entrada clínica',
    href: '/historia-clinica/nuevo',
    icon: Stethoscope,
    requiresWrite: false,
  },
  {
    label: 'Nueva consulta',
    href: '/consultas/nueva',
    icon: Stethoscope,
    requiresWrite: false,
  },
  {
    label: 'Admitir internación',
    href: '/internacion/nueva',
    icon: BedDouble,
    requiresWrite: false,
  },
  {
    label: 'Registrar vacuna',
    href: '/vacunacion/nueva',
    icon: Syringe,
    requiresWrite: false,
  },
  {
    label: 'Programar cirugía',
    href: '/cirugias/nueva',
    icon: Scissors,
    requiresWrite: false,
  },
  {
    label: 'Orden de laboratorio',
    href: '/laboratorio/nueva',
    icon: FlaskConical,
    requiresWrite: false,
  },
  {
    label: 'Nuevo producto',
    href: '/inventario/nuevo',
    icon: Package,
    requiresWrite: false,
  },
  {
    label: 'Nueva receta',
    href: '/farmacia/nueva',
    icon: Pill,
    requiresWrite: false,
  },
  {
    label: 'Subir imagen',
    href: '/imagenes/nueva',
    icon: Images,
    requiresWrite: false,
  },
  {
    label: 'Nueva factura',
    href: '/facturacion/nueva',
    icon: Receipt,
    requiresWrite: false,
  },
  {
    label: 'Caja',
    href: '/caja',
    icon: Banknote,
    requiresWrite: false,
  },
  {
    label: 'Ver reportes',
    href: '/reportes',
    icon: BarChart3,
    requiresWrite: false,
  },
  {
    label: 'Auditoría',
    href: '/auditoria',
    icon: ScrollText,
    requiresWrite: false,
  },
  {
    label: 'WhatsApp',
    href: '/whatsapp',
    icon: MessageCircle,
    requiresWrite: false,
  },
  {
    label: 'Recordatorios',
    href: '/recordatorios',
    icon: Bell,
    requiresWrite: false,
  },
  {
    label: 'Notificaciones',
    href: '/notificaciones',
    icon: Inbox,
    requiresWrite: false,
  },
  {
    label: 'IA clínica',
    href: '/ia-clinica',
    icon: Sparkles,
    requiresWrite: false,
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    requiresWrite: false,
  },
] as const;

export function DashboardQuickActions({ canWritePatients }: DashboardQuickActionsProps) {
  const visibleActions = ACTIONS.filter(
    (action) => !action.requiresWrite || canWritePatients
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones rápidas</CardTitle>
        <CardDescription>Operaciones frecuentes en 1 clic</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <Button key={action.href} variant="outline" size="sm" asChild>
            <Link href={action.href}>
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
