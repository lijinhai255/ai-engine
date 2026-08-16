import { Body, Controller, Get, Post } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    getHello() {
        return this.appService.getHello()
    }

    @Post()
    saveUser(@Body() user: { email: string; name: string }) {
        return this.appService.saveUser(user)
    }

    @Post('/app')
    saveApp(@Body() app: { name: string }) {
        return this.appService.saveApp({ ...app, userId: 'cmk80zgi30000gbtuem43e9q7' })
    }
}
