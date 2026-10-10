"""
LESSON: OneToOneField.

A OneToOneField is a ForeignKey with unique=True.
One User <-> exactly one Profile.
"""
from django.conf import settings
from django.db import models


class Profile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        WAREHOUSE = "warehouse", "Warehouse"
        SELLER = "seller", "Seller"

    # PK: automatic "id" (BigAutoField, see DEFAULT_AUTO_FIELD in settings.py)
    # FK column in the database: "user_id", with a UNIQUE index on it.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,   # user deleted -> profile deleted with it
        related_name="profile",     # reverse access: user.profile
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SELLER)
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


def is_admin(user) -> bool:
    """Superuser, or a profile with role=admin."""
    if user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    return profile is not None and profile.role == Profile.Role.ADMIN
