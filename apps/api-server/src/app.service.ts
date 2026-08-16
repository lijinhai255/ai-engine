import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service'

@Injectable()
export class AppService {
    constructor(private readonly prismaService: PrismaService) {}
    async getHello(): Promise<string> {
        // const users = await this.prismaService.user.findMany()
        // console.log('🚀 ~ AppService ~ getHello ~ users:', users)
        return 'Hello World!'
    }

    async saveUser(user: any) {
        await this.prismaService.user.create({
            data: user,
        })
    }

    async saveApp(app: any) {
        await this.prismaService.app.create({
            data: app,
        })
    }
}
