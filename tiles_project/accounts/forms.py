from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import Profile


class UserRegisterForm(UserCreationForm):
  email = forms.EmailField(required=True)

  class Meta:
    model = User
    fields = ['username', 'email']

  def save(self, commit=True):
    user = super().save(commit=False)
    if commit:
      user.save()
      # Автоматически создаем Profile с ролью SELLER
      Profile.objects.get_or_create(
          user=user, defaults={'role': Profile.Role.SELLER}
      )
    return user