from django.db import models


class Customer(models.Model):
    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    vip = models.BooleanField(default=False)
