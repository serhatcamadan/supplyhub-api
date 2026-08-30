import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator.js'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy.js'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!roles || roles.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>()
    if (!user) throw new ForbiddenException()

    const allowed = roles.some((role) => {
      if (role === 'seller') return user.companyType === 'seller'
      if (role === 'buyer') return user.companyType === 'buyer'
      if (role === 'buyer/admin') return user.companyType === 'buyer' && user.role === 'admin'
      if (role === 'buyer/staff') return user.companyType === 'buyer' && user.role === 'staff'
      return false
    })

    if (!allowed) throw new ForbiddenException()
    return true
  }
}
