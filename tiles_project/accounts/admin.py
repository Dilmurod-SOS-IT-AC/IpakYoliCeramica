from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "role", "telegram_id"]
    list_select_related = ["user"]   # JOIN the FK instead of one query per row
    list_filter = ["role"]
